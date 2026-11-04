"""Actualiza el atlas con un export nuevo de Trakt.

Uso (desde pipeline/):
    python -m atlas.tmdb       --trakt raw/<export>.zip --raw raw --data ../public/data   # con red
    python -m atlas.actualizar --trakt raw/<export>.zip --raw raw --data ../public/data

Qué hace, en orden:
1. Lee el export (primera y última vez que viste cada película, notas, historial).
2. Reentrena el modelo de gusto P(ver) y puntúa las candidatas no vistas, con sus porqués.
   Si tus notas pasan la validación, el orden suma su afinidad con ellas (atlas/notas.py).
3. Mide el AUC en validación cruzada y el backtest temporal (conservador y techo).
4. Recalcula stats y vistas, y sincroniza el "visto" en fichas, galaxia y grafo (16B).
   Arma "porque te gustó X" con las recomendaciones de TMDB de tus favoritas.
5. Aplica los derivados de la web (derivar_front) y pasa la puerta de calidad.
6. Solo si todo lo anterior sale bien, escribe los JSON (cada uno de forma atómica).

La galaxia (coordenadas), las similares y la industria no se recalculan: el dataset de
Kaggle está congelado en 2017 y sus resultados también.
"""

from __future__ import annotations

import argparse
import pickle
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from . import config
from .archivos import escribir_json, leer_cache, leer_json
from .backtest import backtest
from .derivar_front import aplicar_derivados
from .estadisticas import calcular_stats
from .modelo import (EspacioTexto, ajustar_texto, auc_validacion_cruzada, coeficientes_legibles, anteponer,
                     construir_features, entrenar, porques, texto_pelicula)
from .notas import afinidad, combinar, estandarizada, nota_ponderada, senal_suficiente, spearman, validar
from .puerta import revisar
from .recomendaciones import grupos_porque
from .sincronizar import (ErrorSincronizacion, Informe, agregar_sugeridas, sincronizar_fichas, sincronizar_galaxia,
                          sincronizar_grafo)
from .trakt import ErrorExport, ExportTrakt, cargar_export

ARCHIVOS_ESCRITOS = ("fichas", "galaxia", "grafo", "gusto", "similares", "stats", "vistas")


def cargar_dataset(raw: Path) -> pd.DataFrame:
    md = pickle.load(open(raw / "md_full.pkl", "rb"))
    return md[md.year.notna()].copy()


def vectores_calificadas(md: pd.DataFrame, espacio: EspacioTexto, notas: dict[int, int],
                         textos: dict[str, Any]) -> tuple[list[int], np.ndarray, np.ndarray]:
    """Ids, vector de contenido y nota media TMDB de cada película calificada.

    Del dataset si está; si no, de su texto de TMDB (tmdb_textos.json) proyectado en el
    mismo espacio. Las que no tienen ni lo uno ni lo otro quedan fuera.
    """
    fila = {int(t): i for i, t in enumerate(md.tmdb.values)}
    ids, vectores, va = [], [], []
    for t in sorted(notas):
        if t in fila:
            vectores.append(espacio.E[fila[t]])
            va.append(md.vote_average.iloc[fila[t]])
        else:
            tx = textos.get(str(t))
            if not tx or not (tx["o"] or tx["kw"]):
                continue
            vectores.append(espacio.proyectar([texto_pelicula(tx["o"], tx["g"], tx["kw"])])[0])
            va.append(tx.get("va"))
        ids.append(t)
    R = np.array(vectores) if vectores else np.empty((0, espacio.E.shape[1]))
    return ids, R, np.array(va, dtype=float)


def calcular_gusto(md: pd.DataFrame, export: ExportTrakt, previo: dict[str, Any], espacio: EspacioTexto | None = None,
                   textos: dict[str, Any] | None = None, titulos: dict[int, str] | None = None) -> dict[str, Any]:
    md = md.copy()
    md["visto"] = md.tmdb.isin(export.vistas)
    md["fprimera"] = md.tmdb.map({t: v.primera for t, v in export.vistas.items()})
    espacio = ajustar_texto(md) if espacio is None else espacio
    E = espacio.E

    features = construir_features(md, "visto", E)
    entreno = md[md.vote_count >= config.VOTOS_MIN_ENTRENO]
    modelo = entrenar(features, entreno, "visto")
    # AUC en el mismo universo en el que se entrena (>= 100 votos). En el universo amplio
    # (>= 30) sale más alto, pero porque suma miles de películas oscuras fáciles de descartar.
    auc, auc_std = auc_validacion_cruzada(features, entreno, "visto")
    amplio = md[md.vote_count >= config.VOTOS_MIN_CANDIDATA]

    # lo que calificaste también lo viste, aunque Trakt no lo tenga en el historial
    candidatas = amplio[~amplio.visto & ~amplio.tmdb.isin(export.notas)]
    F = features(candidatas)
    score = modelo.predict_proba(F.values)[:, 1]

    # segunda etapa P(gustar | ver): solo cuentan notas de películas del dataset con votos suficientes
    md["nota"] = md.tmdb.map(export.notas)
    con_nota = md[md.nota.notna() & (md.vote_count >= config.VOTOS_MIN_CANDIDATA)]
    activa = len(con_nota) >= config.UMBRAL_SEGUNDA_ETAPA
    if activa:
        gusta = con_nota.assign(gusta=con_nota.nota >= config.NOTA_GUSTA)
        modelo_gusto = entrenar(features, gusta, "gusta")
        score = 0.6 * score + 0.4 * modelo_gusto.predict_proba(F.values)[:, 1]

    razones = porques(modelo, F)

    # tus notas: afinidad de cada candidata con lo que calificaste, solo si pasa la validación
    ids_cal, R, va = vectores_calificadas(md, espacio, export.notas, textos or {})
    nota_cal = np.array([export.notas[t] for t in ids_cal], dtype=float)
    rho = validar(R, nota_cal, config.NOTA_NEUTRA) if len(ids_cal) else None
    con_va = ~np.isnan(va)
    rho_base = spearman(va[con_va], nota_cal[con_va])  # referencia: ¿basta con la nota media de TMDB?
    notas_activa = senal_suficiente(rho, len(ids_cal), config.NOTAS_MIN_AFINIDAD)
    if notas_activa:
        fila = {int(t): i for i, t in enumerate(md.tmdb.values)}
        aff, mejor = afinidad(E[[fila[int(t)] for t in candidatas.tmdb]], R, nota_cal - config.NOTA_NEUTRA)
        score = combinar(score, aff, config.PESO_NOTAS)
        nombres = titulos or {}
        z = estandarizada(aff)
        razones = anteponer(razones, [
            f"parecida a {nombres.get(ids_cal[m], f'tu {int(nota_cal[m])}')}" if m >= 0 and z[i] >= config.UMBRAL_PARECIDA else None
            for i, m in enumerate(mejor)])

    # calidad: la nota media de TMDB (ponderada por votos), solo si predice tus notas por encima del azar
    calidad_activa = config.PESO_CALIDAD > 0 and senal_suficiente(rho_base, int(con_va.sum()), config.NOTAS_MIN_AFINIDAD)
    if calidad_activa:
        calidad = nota_ponderada(candidatas.vote_average.to_numpy(), candidatas.vote_count.to_numpy(), config.VOTOS_PRIOR_CALIDAD)
        score = combinar(score, calidad, config.PESO_CALIDAD)
        razones = anteponer(razones, ["muy bien valorada" if c >= config.NOTA_BIEN_VALORADA else None for c in calidad])

    ids = candidatas.tmdb.values
    orden = sorted(range(len(ids)), key=lambda i: (-score[i], int(ids[i])))  # empate: por id
    return {
        "benchmark": previo["benchmark"],  # torneo de 9 modelos: resultado congelado de julio 2026
        "auc_cv": [round(auc, 4), round(auc_std, 4)],
        "coefs": coeficientes_legibles(modelo, list(F.columns)),
        "candidatos": [{"id": int(ids[i]), "s": round(float(score[i]), 3), "r": razones.por_fila[i]} for i in orden],
        "leyenda": razones.leyenda,
        "backtest": backtest(md, E),
        "segunda_etapa": {
            "activa": bool(activa),
            "notas": int(len(con_nota)),
            "notas_totales": len(export.notas),
            "umbral": config.UMBRAL_SEGUNDA_ETAPA,
        },
        # rho: validación dejando fuera cada nota; rho_base: la nota media de TMDB frente a las tuyas
        "notas": {
            "activa": bool(notas_activa),
            "n": len(ids_cal),
            "rho": None if rho is None else round(rho, 3),
            "rho_base": None if rho_base is None else round(rho_base, 3),
            "minimo": config.NOTAS_MIN_AFINIDAD,
            "peso": config.PESO_NOTAS,
            "calidad_activa": bool(calidad_activa),
        },
        # "porque te gustó X": lo completa actualizar(), que necesita las fichas ya sincronizadas
        "porque": {"nota_min": config.NOTA_FAVORITA, "grupos": []},
    }



def titulos_de(export: ExportTrakt, fichas: dict[str, Any], cache_tmdb: dict[str, Any], titulos_es: dict[str, str]) -> dict[int, str]:
    """Título con el que nombrar cada película calificada: en español si se conoce."""
    salida = {}
    for t in export.notas:
        clave = str(t)
        ficha = fichas.get(clave) or cache_tmdb.get(clave) or {}
        vista = export.vistas.get(t)
        titulo = titulos_es.get(clave) or ficha.get("t") or (vista.titulo if vista else "")
        if titulo:
            salida[t] = titulo
    return salida


def actualizar(trakt: Path, raw: Path, data: Path, forzar: bool = False) -> int:
    export = cargar_export(trakt)
    print(f"Export: {len(export.vistas)} películas vistas, {export.plays} visionados, {len(export.notas)} notas")
    print(f"  con fecha fiable: {len(export.historial_fiable)} | sin fecha: {export.sin_fecha} | "
          f"de cargas en bloque: {export.en_bloque}")
    for motivo, n in export.descartadas.items():
        print(f"  aviso: {n} descartadas ({motivo})")

    md = cargar_dataset(raw)
    previos = {n: leer_json(data / f"{n}.json") for n in ARCHIVOS_ESCRITOS}
    cache_tmdb = leer_cache(raw / "tmdb_cache.json")
    titulos_es = leer_cache(raw / "titulos_es.json")
    textos = leer_cache(raw / "tmdb_textos.json")
    recs = {int(k): v for k, v in leer_cache(raw / "tmdb_recomendaciones.json").items()}

    print("Entrenando el modelo de gusto y el backtest…")
    gusto = calcular_gusto(md, export, previos["gusto"], textos=textos,
                           titulos=titulos_de(export, previos["fichas"], cache_tmdb, titulos_es))

    vistas_ids = set(export.vistas)
    informe = Informe()
    fichas = sincronizar_fichas(previos["fichas"], vistas_ids, cache_tmdb, titulos_es, informe)
    grupos = grupos_porque(export, recs, tiene_ficha=lambda i: str(i) in fichas or str(i) in cache_tmdb)
    gusto["porque"]["grupos"] = grupos
    # la favorita también necesita ficha (para nombrarla), aunque la calificaras sin tenerla en el historial
    fichas = agregar_sugeridas(fichas, [i for g in grupos for i in [g["id"], *g["recs"]]], cache_tmdb, titulos_es, informe)
    datos: dict[str, Any] = {
        "fichas": fichas,
        "galaxia": sincronizar_galaxia(previos["galaxia"], vistas_ids, informe),
        "grafo": sincronizar_grafo(previos["grafo"], fichas, vistas_ids, informe),
        "gusto": gusto,
        "similares": previos["similares"],
        "stats": calcular_stats(export, md, fichas, previos["stats"]),
        # d: última fecha fiable; None (null) si la viste sin fecha (issue 20)
        "vistas": {str(t): {"d": v.ultima, "n": v.veces} for t, v in sorted(export.vistas.items())},
    }
    aplicar_derivados(datos)

    veredicto = revisar(previos["gusto"], gusto)
    bt = gusto["backtest"]
    print(f"AUC {gusto['auc_cv'][0]:.3f} ± {gusto['auc_cv'][1]:.3f} | backtest conservador top-10% {bt['top10']}% "
          f"(techo {bt['techo']['top10']}%), {bt['p100']} de su top-100 (azar ~{bt['azar100']}), "
          f"{bt['n_sin_fecha']} vistas sin fecha fiable fuera del backtest")
    na = gusto["notas"]
    print(f"Tus notas: {na['n']} con texto, validación rho {na['rho']} (nota TMDB sola: {na['rho_base']}) -> "
          f"{'se aplican al orden' if na['activa'] else 'no se aplican'}, calidad {'aplicada' if na['calidad_activa'] else 'no aplicada'} | porque te gustó: {len(grupos)} favoritas, "
          f"{len(informe.fichas_sugeridas)} fichas sugeridas nuevas")
    print(f"Fichas nuevas: {len(informe.fichas_nuevas)} | cambios de 'visto' en fichas: {informe.fichas_cambiadas}, "
          f"en galaxia: {informe.galaxia_cambiadas} | nodos nuevos en el grafo: {len(informe.grafo_nodos_nuevos)} "
          f"(sin personas en el grafo: {len(informe.grafo_sin_personas)}) | títulos en español: {informe.titulos_es}")
    for a in veredicto.avisos:
        print(f"  aviso: {a}")
    if not veredicto.aprobado:
        for p in veredicto.problemas:
            print(f"  PROBLEMA: {p}", file=sys.stderr)
        if not forzar:
            print("No se escribió nada. Revisa los problemas o usa --forzar si el cambio es esperado.", file=sys.stderr)
            return 1
        print("--forzar: se publica pese a los problemas.", file=sys.stderr)

    for nombre in ARCHIVOS_ESCRITOS:
        escribir_json(data / f"{nombre}.json", datos[nombre])
    print(f"Listo: {len(ARCHIVOS_ESCRITOS)} archivos actualizados en {data}. Siguiente: npm run check y push.")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Actualiza el atlas con un export nuevo de Trakt")
    p.add_argument("--trakt", required=True, type=Path, help="export de Trakt (.zip o carpeta)")
    p.add_argument("--raw", required=True, type=Path, help="carpeta con md_full.pkl y las cachés de TMDB")
    p.add_argument("--data", required=True, type=Path, help="carpeta public/data de la web")
    p.add_argument("--forzar", action="store_true", help="publicar aunque la puerta de calidad falle")
    a = p.parse_args(argv)
    try:
        return actualizar(a.trakt, a.raw, a.data, a.forzar)
    except (ErrorExport, ErrorSincronizacion, FileNotFoundError) as e:
        print(f"\n{e}\nNo se escribió nada.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
