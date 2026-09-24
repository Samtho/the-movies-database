"""Actualiza el atlas con un export nuevo de Trakt.

Uso (desde pipeline/):
    python -m atlas.tmdb       --trakt raw/<export>.zip --raw raw --data ../public/data   # con red
    python -m atlas.actualizar --trakt raw/<export>.zip --raw raw --data ../public/data

Qué hace, en orden:
1. Lee el export (primera y última vez que viste cada película, notas, historial).
2. Reentrena el modelo de gusto P(ver) y puntúa las candidatas no vistas, con sus porqués.
3. Mide el AUC en validación cruzada y el backtest temporal (conservador y techo).
4. Recalcula stats y vistas, y sincroniza el "visto" en fichas, galaxia y grafo (16B).
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
from .archivos import escribir_json, leer_json
from .backtest import backtest
from .derivar_front import aplicar_derivados
from .estadisticas import calcular_stats
from .modelo import (auc_validacion_cruzada, coeficientes_legibles, construir_features, embeddings_texto, entrenar,
                     porques)
from .puerta import revisar
from .sincronizar import Informe, sincronizar_fichas, sincronizar_galaxia, sincronizar_grafo
from .trakt import ExportTrakt, cargar_export

ARCHIVOS_ESCRITOS = ("fichas", "galaxia", "grafo", "gusto", "similares", "stats", "vistas")


def cargar_dataset(raw: Path) -> pd.DataFrame:
    md = pickle.load(open(raw / "md_full.pkl", "rb"))
    return md[md.year.notna()].copy()


def calcular_gusto(md: pd.DataFrame, export: ExportTrakt, previo: dict[str, Any], E: np.ndarray | None = None) -> dict[str, Any]:
    md = md.copy()
    md["visto"] = md.tmdb.isin(export.vistas)
    md["fprimera"] = md.tmdb.map({t: v.primera for t, v in export.vistas.items()})
    E = embeddings_texto(md) if E is None else E

    features = construir_features(md, "visto", E)
    entreno = md[md.vote_count >= config.VOTOS_MIN_ENTRENO]
    modelo = entrenar(features, entreno, "visto")
    # AUC en el mismo universo en el que se entrena (>= 100 votos). En el universo amplio
    # (>= 30) sale más alto, pero porque suma miles de películas oscuras fáciles de descartar.
    auc, auc_std = auc_validacion_cruzada(features, entreno, "visto")
    amplio = md[md.vote_count >= config.VOTOS_MIN_CANDIDATA]

    candidatas = amplio[~amplio.visto]
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
    }


def actualizar(trakt: Path, raw: Path, data: Path, forzar: bool = False) -> int:
    export = cargar_export(trakt)
    print(f"Export: {len(export.vistas)} películas vistas, {len(export.historial)} visionados, {len(export.notas)} notas")
    for motivo, n in export.descartadas.items():
        print(f"  aviso: {n} descartadas ({motivo})")

    md = cargar_dataset(raw)
    previos = {n: leer_json(data / f"{n}.json") for n in ARCHIVOS_ESCRITOS}
    cache_tmdb = leer_json(raw / "tmdb_cache.json") if (raw / "tmdb_cache.json").exists() else {}
    titulos_es = leer_json(raw / "titulos_es.json") if (raw / "titulos_es.json").exists() else {}

    print("Entrenando el modelo de gusto y el backtest…")
    gusto = calcular_gusto(md, export, previos["gusto"])

    vistas_ids = set(export.vistas)
    informe = Informe()
    fichas = sincronizar_fichas(previos["fichas"], vistas_ids, cache_tmdb, titulos_es, informe)
    datos: dict[str, Any] = {
        "fichas": fichas,
        "galaxia": sincronizar_galaxia(previos["galaxia"], vistas_ids, informe),
        "grafo": sincronizar_grafo(previos["grafo"], fichas, vistas_ids, informe),
        "gusto": gusto,
        "similares": previos["similares"],
        "stats": calcular_stats(export, md, fichas, previos["stats"]),
        "vistas": {str(t): {"d": v.ultima, "n": v.veces} for t, v in sorted(export.vistas.items())},
    }
    aplicar_derivados(datos)

    veredicto = revisar(previos["gusto"], gusto)
    bt = gusto["backtest"]
    print(f"AUC {gusto['auc_cv'][0]:.3f} ± {gusto['auc_cv'][1]:.3f} | backtest conservador top-10% {bt['top10']}% "
          f"(techo {bt['techo']['top10']}%), {bt['p100']} de su top-100 (azar ~{bt['azar100']})")
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
    return actualizar(a.trakt, a.raw, a.data, a.forzar)


if __name__ == "__main__":
    sys.exit(main())
