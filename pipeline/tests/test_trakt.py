import json
import zipfile
from datetime import datetime, timedelta, timezone

import pytest

from atlas.trakt import ErrorExport, cargar_export, instante, instantes_en_bloque
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
    assert len(ex.historial_fiable) == 2  # la del historial sin id sí cuenta como visionado; el episodio no


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


# ---------- fechas no fiables (issues 20 y 21) ----------
DESCONOCIDA = "1970-01-01T00:00:00.000Z"  # así llega "no recuerdo cuándo la vi"
UTC = timezone.utc


@pytest.mark.parametrize("marca, esperado", [
    ("2020-01-01T10:00:00.000Z", datetime(2020, 1, 1, 10, tzinfo=UTC)),
    ("2020-01-01T10:00:00Z", datetime(2020, 1, 1, 10, tzinfo=UTC)),
    ("2020-01-01T10:00:00", datetime(2020, 1, 1, 10, tzinfo=UTC)),  # sin zona: UTC, como el resto del export
    ("2020-01-01T12:00:00+02:00", datetime(2020, 1, 1, 10, tzinfo=UTC)),  # con zona: se pasa a UTC
    ("1970-01-01T00:00:00.000Z", None),
    ("1970-01-01T00:00:00Z", None),
    ("1970-01-01T00:00:00", None),
    ("1970-01-01T00:00:01.000Z", datetime(1970, 1, 1, 0, 0, 1, tzinfo=UTC)),  # solo el instante cero es "desconocida"
    ("", None),
    (None, None),
    ("ayer por la noche", None),
])
def test_instante(marca, esperado):
    assert instante(marca) == esperado


def horas(*hs: float) -> list[datetime]:
    base = datetime(2015, 2, 18, 3, 0, tzinfo=UTC)
    return [base + timedelta(hours=h) for h in hs]


@pytest.mark.parametrize("instantes, en_bloque", [
    (horas(*[0] * 10), 1),  # 10 en el mismo minuto: un único instante repetido
    (horas(*range(10)), 10),  # 10 en 9 horas
    (horas(*[i * 12 / 9 for i in range(10)]), 10),  # 10 en 12 horas justas: el borde cuenta
    (horas(*[i * 12.02 / 9 for i in range(10)]), 0),  # 10 en 12 horas y 1 minuto: no
    (horas(*range(9)), 0),  # 9: por debajo del mínimo
    (horas(*range(10), 100), 10),  # el visionado suelto de días después no se contagia
    ([], 0),
])
def test_instantes_en_bloque(instantes, en_bloque):
    assert len(instantes_en_bloque(instantes)) == en_bloque


def test_carga_en_bloque_que_cruza_la_medianoche():
    # 5 antes y 5 después de medianoche (UTC): por días naturales no llegaría a 10
    cerca = [datetime(2018, 7, 7, 22, tzinfo=UTC) + timedelta(minutes=30 * i) for i in range(10)]
    assert len(instantes_en_bloque(cerca)) == 10


def test_umbral_configurable():
    assert len(instantes_en_bloque(horas(0, 1, 2), minimo=3, horas=2)) == 3
    assert instantes_en_bloque(horas(0, 1, 2), minimo=3, horas=1.5) == set()


def test_fecha_desconocida_cuenta_como_vista_sin_fecha(tmp_path):
    ex = cargar_export(guardar_export(export_trakt({1001: [DESCONOCIDA], 1002: ["2020-05-02T21:00:00.000Z"]}), tmp_path))
    v = ex.vistas[1001]
    assert (v.primera, v.ultima, v.veces) == (None, None, 1)
    assert ex.historial_fiable == ["2020-05-02T21:00:00.000Z"]
    assert (ex.sin_fecha, ex.en_bloque) == (1, 0)


def test_fecha_real_y_desconocida_en_la_misma_pelicula(tmp_path):
    # la última fecha conocida se muestra; la primera vez no se sabe (pudo ser antes)
    ex = cargar_export(guardar_export(export_trakt({1001: [DESCONOCIDA, "2020-05-02T21:00:00.000Z"]}), tmp_path))
    v = ex.vistas[1001]
    assert (v.primera, v.ultima, v.veces) == (None, "2020-05-02", 2)


def test_vista_sin_ultima_fecha_ni_historial_sigue_contando(tmp_path):
    archivos = export_trakt({})
    archivos["watched-movies-1.json"] = [{"plays": 1, "movie": {"title": "Sin fecha", "ids": {"tmdb": 7}}}]
    ex = cargar_export(guardar_export(archivos, tmp_path))
    assert (ex.vistas[7].primera, ex.vistas[7].ultima, ex.vistas[7].veces) == (None, None, 1)
    assert ex.descartadas == {}


def test_historial_sin_fecha_cuenta_como_sin_fecha(tmp_path):
    archivos = export_trakt({1001: ["2020-05-02T21:00:00.000Z"]})
    archivos["watched-history-1.json"].append({"type": "movie", "movie": {"ids": {"tmdb": 1001}}})
    ex = cargar_export(guardar_export(archivos, tmp_path))
    assert ex.sin_fecha == 1 and ex.vistas[1001].primera is None and ex.vistas[1001].ultima == "2020-05-02"


def test_carga_en_bloque_en_el_export(tmp_path):
    carga = {2000 + i: [f"2015-02-18T03:{40 + i}:00.000Z"] for i in range(12)}  # 12 en 12 minutos
    normales = {1001: ["2014-06-01T21:00:00.000Z"], 1002: ["2016-03-01T22:00:00.000Z"]}
    repetida = {2100: ["2015-02-18T03:59:00.000Z", "2020-01-05T21:00:00.000Z"]}  # en la carga y vista de verdad después
    ex = cargar_export(guardar_export(export_trakt(carga | normales | repetida), tmp_path))
    assert (ex.en_bloque, ex.sin_fecha) == (13, 0)
    assert all(ex.vistas[t].primera is None and ex.vistas[t].ultima is None for t in carga)
    assert (ex.vistas[1001].primera, ex.vistas[1002].primera) == ("2014-06-01", "2016-03-01")
    assert (ex.vistas[2100].primera, ex.vistas[2100].ultima) == (None, "2020-01-05")
    assert sorted(ex.historial_fiable) == ["2014-06-01T21:00:00.000Z", "2016-03-01T22:00:00.000Z", "2020-01-05T21:00:00.000Z"]
    assert len(ex.vistas) == 15  # todas cuentan como vistas


def test_ultima_fecha_de_watched_movies_en_una_carga_no_cuenta(tmp_path):
    # sin historial de esa película, pero su última fecha cae dentro de una carga
    carga = {2000 + i: [f"2015-02-18T03:{40 + i}:00.000Z"] for i in range(10)}
    archivos = export_trakt(carga)
    archivos["watched-movies-2.json"].append({"last_watched_at": "2015-02-18T03:45:00.000Z", "plays": 1,
                                              "movie": {"title": "Sin historial", "ids": {"tmdb": 3000}}})
    v = cargar_export(guardar_export(archivos, tmp_path)).vistas[3000]
    assert (v.primera, v.ultima) == (None, None)
