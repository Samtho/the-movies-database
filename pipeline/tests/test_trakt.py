import json
import zipfile

import pytest

from atlas.trakt import ErrorExport, cargar_export
from conftest import export_trakt, guardar_export


@pytest.mark.parametrize("como_zip", [True, False])
def test_lee_zip_y_carpeta_igual(tmp_path, como_zip):
    archivos = export_trakt({1001: ["2010-03-01T20:00:00.000Z"], 1002: ["2020-05-02T21:00:00.000Z"]})
    ex = cargar_export(guardar_export(archivos, tmp_path, como_zip))
    assert set(ex.vistas) == {1001, 1002}
    assert ex.plays == 2 and ex.minutos == 240


def test_primera_y_ultima_vez_de_una_repetida(tmp_path):
    # vista en 2010 y repetida en 2016: la primera es 2010 (el bug de julio usaba 2016)
    archivos = export_trakt({1001: ["2016-01-02T20:00:00.000Z", "2010-03-01T20:00:00.000Z"]})
    v = cargar_export(guardar_export(archivos, tmp_path)).vistas[1001]
    assert (v.primera, v.ultima, v.veces) == ("2010-03-01", "2016-01-02", 2)


def test_sin_historial_la_primera_es_la_ultima_conocida(tmp_path):
    archivos = export_trakt({1001: ["2012-01-01T20:00:00.000Z"]})
    archivos["watched-history-1.json"] = []
    v = cargar_export(guardar_export(archivos, tmp_path)).vistas[1001]
    assert v.primera == v.ultima == "2012-01-01"


def test_paginas_en_orden_numerico_no_alfabetico(tmp_path):
    archivos = export_trakt({})
    archivos.pop("watched-movies-2.json")
    archivos["watched-movies-1.json"] = [{"last_watched_at": "2020-01-01T00:00:00Z", "plays": 1, "movie": {"title": "A", "ids": {"tmdb": 1}}}]
    archivos["watched-movies-10.json"] = [{"last_watched_at": "2021-01-01T00:00:00Z", "plays": 1, "movie": {"title": "B", "ids": {"tmdb": 2}}}]
    archivos["watched-movies-2.json"] = [{"last_watched_at": "2019-01-01T00:00:00Z", "plays": 1, "movie": {"title": "C", "ids": {"tmdb": 3}}}]
    ex = cargar_export(guardar_export(archivos, tmp_path, como_zip=False))
    assert list(ex.vistas) == [1, 3, 2]


def test_descarta_y_cuenta_las_vistas_sin_id(tmp_path):
    archivos = export_trakt({1001: ["2012-01-01T20:00:00.000Z"]})
    archivos["watched-movies-2.json"].append({"last_watched_at": "2012-01-01T00:00:00Z", "plays": 1, "movie": {"title": "X", "ids": {}}})
    archivos["watched-history-1.json"].append({"type": "movie", "watched_at": "2012-01-01T00:00:00Z", "movie": {"ids": {}}})
    archivos["watched-history-1.json"].append({"type": "episode", "watched_at": "2012-01-01T00:00:00Z"})
    ex = cargar_export(guardar_export(archivos, tmp_path))
    assert set(ex.vistas) == {1001}
    assert ex.descartadas == {"vista sin id de TMDB": 1, "historial sin id de TMDB": 1}
    assert len(ex.historial) == 2  # la del historial sin id sí cuenta como visionado; el episodio no


def test_notas(tmp_path):
    archivos = export_trakt({1001: ["2012-01-01T20:00:00.000Z"]}, notas={1001: 8, 1002: 3})
    archivos["ratings-movies.json"].append({"rating": 9, "movie": {"title": "Sin id", "ids": {}}})
    ex = cargar_export(guardar_export(archivos, tmp_path))
    assert ex.notas == {1001: 8, 1002: 3}
    assert [r["id"] for r in ex.ratings] == [1001, 1002, None]


def test_errores_claros(tmp_path):
    with pytest.raises(ErrorExport, match="No existe"):
        cargar_export(tmp_path / "no-existe.zip")
    vacio = tmp_path / "vacio.zip"
    with zipfile.ZipFile(vacio, "w") as z:
        z.writestr("user-stats.json", json.dumps({"movies": {}}))
    with pytest.raises(ErrorExport, match="watched-movies"):
        cargar_export(vacio)
    sin_stats = export_trakt({1001: ["2012-01-01T20:00:00.000Z"]})
    sin_stats.pop("user-stats.json")
    with pytest.raises(ErrorExport, match="user-stats"):
        cargar_export(guardar_export(sin_stats, tmp_path))
