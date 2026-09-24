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


def montar(tmp_path: Path, previo_gusto: dict | None = None, con_cache: bool = True):
    md = dataset_sintetico()
    raw, data = tmp_path / "raw", tmp_path / "data"
    raw.mkdir()
    data.mkdir()
    pickle.dump(md, open(raw / "md_full.pkl", "wb"))
    cache = {str(POST2017): {"t": "Reciente", "a": 2024, "g": ["Drama"], "d": "Director 1", "dp": None, "c": ["Actor 1"], "cp": [None],
                             "rt": 100, "va": 7.0, "nv": 500, "p": "/r.jpg", "o": "Una película reciente"}}
    (raw / "tmdb_cache.json").write_text(json.dumps(cache if con_cache else {}))

    visibles = list(md.tmdb[md.vote_count >= 100])
    vistas = {t: [f"20{10 + i % 5:02d}-0{1 + i % 9}-15T20:30:00.000Z"] for i, t in enumerate(visibles[:25])}  # antes del corte
    vistas |= {t: [f"2016-0{1 + i % 9}-10T21:00:00.000Z"] for i, t in enumerate(list(md.tmdb[md.vote_count >= 30])[60:72])}  # después
    repetida = visibles[0]
    vistas[repetida] = ["2011-02-01T20:00:00.000Z", "2019-05-01T22:00:00.000Z"]  # vista antes y repetida después del corte
    vistas[POST2017] = ["2026-08-20T20:00:00.000Z"]
    trakt = guardar_export(export_trakt(vistas, notas={visibles[1]: 9, POST2017: 7}, titulo=lambda t: f"Título {t}"), tmp_path)

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
    assert gusto["backtest"]["metodo"] == 2 and "techo" in gusto["backtest"]
    assert gusto["segunda_etapa"] == {"activa": False, "notas": 1, "notas_totales": 2, "umbral": 150}

    # la post-2017 tiene ficha nueva y marcada como vista; el resto refleja el historial
    assert fichas[str(POST2017)]["v"] == 1 and fichas[str(POST2017)]["reciente"] == 1
    assert all((f["v"] == 1) == (int(k) in vistos) for k, f in fichas.items())
    assert all((p["v"] == 1) == (p["id"] in vistos) for p in leer(data, "galaxia"))

    # la repetida guarda la última fecha para la web y cuenta sus dos visionados
    assert vistas[str(repetida)] == {"d": "2019-05-01", "n": 2}
    assert stats["total_vistas"] == len(vistos) and stats["post2017"] == 1
    assert sum(n for _, n in stats["mensual"]) == stats["plays"]
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
