"""De punta a punta con datos sintéticos: export -> modelo -> sincronización -> JSON de la web."""

import json
import pickle
import shutil
from pathlib import Path

import pytest

from atlas.actualizar import actualizar
from atlas.sincronizar import ErrorSincronizacion
from conftest import dataset_sintetico, export_trakt, guardar_export

POST2017 = 999_001  # vista que no está en el dataset: su ficha sale de la caché de TMDB
SIN_FECHA = 1150  # del dataset, vista con fecha desconocida


def montar(tmp_path: Path, previo_gusto: dict | None = None, con_cache: bool = True, notas: dict | None = None,
           textos: dict | None = None, recs: dict | None = None, cache_extra: dict | None = None, md=None):
    md = dataset_sintetico() if md is None else md
    raw, data = tmp_path / "raw", tmp_path / "data"
    raw.mkdir()
    data.mkdir()
    pickle.dump(md, open(raw / "md_full.pkl", "wb"))
    cache = {str(POST2017): {"t": "Reciente", "a": 2024, "g": ["Drama"], "d": "Director 1", "dp": None, "c": ["Actor 1"], "cp": [None],
                             "rt": 100, "va": 7.0, "nv": 500, "p": "/r.jpg", "o": "Una película reciente"}}
    (raw / "tmdb_cache.json").write_text(json.dumps({**cache, **(cache_extra or {})} if con_cache else {}))
    if textos is not None:
        (raw / "tmdb_textos.json").write_text(json.dumps(textos))
    if recs is not None:
        (raw / "tmdb_recomendaciones.json").write_text(json.dumps(recs))

    visibles = list(md.tmdb[md.vote_count >= 100])
    vistas = {t: [f"20{10 + i % 5:02d}-0{1 + i % 9}-15T20:30:00.000Z"] for i, t in enumerate(visibles[:25])}  # antes del corte
    vistas |= {t: [f"2016-0{1 + i % 9}-10T21:00:00.000Z"] for i, t in enumerate(list(md.tmdb[md.vote_count >= 30])[60:72])}  # después
    repetida = visibles[0]
    vistas[repetida] = ["2011-02-01T20:00:00.000Z", "2019-05-01T22:00:00.000Z"]  # vista antes y repetida después del corte
    vistas[POST2017] = ["2026-08-20T20:00:00.000Z"]
    vistas[SIN_FECHA] = ["1970-01-01T00:00:00.000Z"]  # "no recuerdo cuándo la vi" (issue 20)
    trakt = guardar_export(export_trakt(vistas, notas=notas or {visibles[1]: 9, POST2017: 7}, titulo=lambda t: f"Título {t}"), tmp_path)

    fichas = {str(t): {"t": f"Película {t}", "a": 2000, "g": ["Drama"], "d": "Director 1", "dp": None, "c": ["Actor 1"], "cp": [None],
                       "rt": 100, "va": 7.0, "nv": 100, "p": None, "o": "", "v": 0} for t in md.tmdb}
    galaxia = [{"id": int(t), "x": float(i), "y": 0.0, "t": "x", "a": 2000, "g": "Drama", "v": 0, "s": 5.0, "p": None} for i, t in enumerate(md.tmdb)]
    grafo = {"nodes": [{"t": "d", "l": "Director 1", "v": 0, "x": 0.0, "y": 0.0, "f": None}], "links": []}
    gusto = previo_gusto or {"benchmark": {"Regresión logística": {"auc": 0.8, "std": 0.01}}, "auc_amplio": [0.5, 0.01],
                             "backtest": {"top10": 0}, "candidatos": [{"id": 1}]}
    previos = {"fichas": fichas, "galaxia": galaxia, "grafo": grafo, "gusto": gusto, "similares": {str(md.tmdb[0]): [int(md.tmdb[0]), int(md.tmdb[1])]},
               "stats": {"top_directores": [], "top_actores": []}, "vistas": {}, "industria": {"serie": [], "scatter": []}}
    for nombre, contenido in previos.items():
        (data / f"{nombre}.json").write_text(json.dumps(contenido))
    return trakt, raw, data, repetida


def leer(data: Path, nombre: str):
    return json.loads((data / f"{nombre}.json").read_text())


def test_de_punta_a_punta(tmp_path):
    trakt, raw, data, repetida = montar(tmp_path)
    assert actualizar(trakt, raw, data) == 0

    gusto, fichas, vistas, stats = leer(data, "gusto"), leer(data, "fichas"), leer(data, "vistas"), leer(data, "stats")
    vistos = {int(k) for k in vistas}
    ids = [c["id"] for c in gusto["candidatos"]]
    assert ids and vistos.isdisjoint(ids)  # nunca recomienda lo ya visto
    scores = [c["s"] for c in gusto["candidatos"]]
    assert scores == sorted(scores, reverse=True)
    assert 0 <= gusto["auc_cv"][0] <= 1
    assert gusto["backtest"]["metodo"] == 3 and "techo" in gusto["backtest"]
    assert gusto["backtest"]["n_sin_fecha"] == 1
    assert gusto["segunda_etapa"] == {"activa": False, "notas": 1, "notas_totales": 2, "umbral": 150}
    # dos notas no bastan para validar la afinidad: no se aplica y nada cambia; sin caché de recomendaciones, sin grupos
    assert gusto["notas"]["activa"] is False and gusto["notas"]["calidad_activa"] is False and gusto["notas"]["n"] == 1  # la post-2017 no tiene texto en caché
    assert gusto["porque"] == {"nota_min": 8, "grupos": []}

    # la post-2017 tiene ficha nueva y marcada como vista; el resto refleja el historial
    assert fichas[str(POST2017)]["v"] == 1 and fichas[str(POST2017)]["reciente"] == 1
    assert all((f["v"] == 1) == (int(k) in vistos) for k, f in fichas.items())
    assert all((p["v"] == 1) == (p["id"] in vistos) for p in leer(data, "galaxia"))

    # la repetida guarda la última fecha para la web y cuenta sus dos visionados
    assert vistas[str(repetida)] == {"d": "2019-05-01", "n": 2}
    assert stats["total_vistas"] == len(vistos) and stats["post2017"] == 1
    # la vista sin fecha cuenta como vista, pero no entra en la línea temporal ni en el mapa
    assert vistas[str(SIN_FECHA)] == {"d": None, "n": 1} and fichas[str(SIN_FECHA)]["v"] == 1
    assert stats["fechados"] == stats["plays"] - 1
    assert sum(n for _, n in stats["mensual"]) == stats["fechados"]
    assert stats["horas_registradas"] <= stats["fechados"]
    assert stats["resumen"]["auc"] == pytest.approx(gusto["auc_cv"][0], abs=1e-3)
    assert all(int(k) not in v for k, v in leer(data, "similares").items())  # sin autorreferencias
    assert leer(data, "industria") == {"serie": [], "scatter": []}  # congelada: no se toca


def test_es_determinista(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir()
    b.mkdir()
    ta, ra, da, _ = montar(a)
    tb, rb, db, _ = montar(b)
    assert actualizar(ta, ra, da) == 0 and actualizar(tb, rb, db) == 0
    for nombre in ("gusto", "fichas", "galaxia", "grafo", "stats", "vistas", "similares"):
        assert leer(da, nombre) == leer(db, nombre), nombre


def test_la_puerta_bloquea_y_no_escribe_nada(tmp_path):
    previo = {"benchmark": {}, "auc_cv": [0.999, 0.001], "backtest": {"top10": 100, "metodo": 2}, "candidatos": [{"id": 1}]}
    trakt, raw, data, _ = montar(tmp_path, previo_gusto=previo)
    antes = {p.name: p.read_text() for p in data.iterdir()}
    assert actualizar(trakt, raw, data) == 1
    assert {p.name: p.read_text() for p in data.iterdir()} == antes


def test_sin_cache_de_tmdb_para_una_reciente_falla_antes_de_escribir(tmp_path):
    trakt, raw, data, _ = montar(tmp_path, con_cache=False)
    antes = {p.name: p.read_text() for p in data.iterdir()}
    with pytest.raises(ErrorSincronizacion, match="atlas.tmdb"):
        actualizar(trakt, raw, data)
    assert {p.name: p.read_text() for p in data.iterdir()} == antes
    shutil.rmtree(tmp_path / "raw")


NUEVA = 999_500  # sugerida posterior al dataset: su ficha sale de la caché de TMDB


def test_tus_notas_ordenan_y_porque_te_gusto(tmp_path):
    md = dataset_sintetico()
    # notas con señal: dos familias de contenido; la de fantasmas te gusta, la de bodas no
    con_votos = md[md.vote_count >= 30]
    calificadas = list(con_votos.tmdb[:30])
    for i, t in enumerate(calificadas):
        md.loc[md.tmdb == t, "overview"] = ("fantasma casa noche miedo " if i % 2 else "boda risa familia fiesta ") * 5
        md.loc[md.tmdb == t, "vote_average"] = 8.4 if i % 2 else 5.1  # y también siguen a la nota de TMDB
    notas = {int(t): (9 if i % 2 else 4) for i, t in enumerate(calificadas)}
    notas[POST2017] = 10
    textos = {str(POST2017): {"o": "fantasma casa noche miedo", "g": ["Horror"], "kw": [], "va": 7.5}}
    sin_ver = int(con_votos.tmdb.iloc[-1])
    recs = {str(POST2017): [{"id": sin_ver, "f": "2010-05-01", "nv": 900}, {"id": NUEVA, "f": "2025-01-01", "nv": 300},
                            {"id": 999_600, "f": "2027-01-01", "nv": 300}, {"id": POST2017, "f": "2024-01-01", "nv": 500}]}
    extra = {str(NUEVA): {"t": "Sugerida", "a": 2025, "g": ["Horror"], "d": None, "dp": None, "c": [], "cp": [],
                          "rt": 95, "va": 7.1, "nv": 300, "p": "/s.jpg", "o": "x"}}
    trakt, raw, data, _ = montar(tmp_path, notas=notas, textos=textos, recs=recs, cache_extra=extra, md=md)
    assert actualizar(trakt, raw, data) == 0
    gusto, fichas = leer(data, "gusto"), leer(data, "fichas")

    n = gusto["notas"]
    assert n["n"] == len(notas) and n["rho"] > 0 and n["activa"] is True
    assert n["rho_base"] > 0 and n["calidad_activa"] is True
    assert "muy bien valorada" in gusto["leyenda"]
    ids = [c["id"] for c in gusto["candidatos"]]
    assert not set(ids) & set(notas)  # lo calificado no se recomienda
    assert any(gusto["leyenda"][c["r"][0]].startswith("parecida a ") for c in gusto["candidatos"] if c["r"])
    scores = [c["s"] for c in gusto["candidatos"]]
    assert scores == sorted(scores, reverse=True) and all(0 <= x <= 1 for x in scores)

    # porque te gustó: solo la favorita con sugerencias útiles; fuera lo no estrenado y la propia
    assert gusto["porque"]["grupos"][0] == {"id": POST2017, "n": 10, "recs": [sin_ver, NUEVA]}
    assert fichas[str(NUEVA)]["v"] == 0 and fichas[str(NUEVA)]["reciente"] == 1
    assert "999600" not in fichas
