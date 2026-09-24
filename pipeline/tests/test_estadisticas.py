import pytest

from atlas.estadisticas import a_local, calcular_stats, horas_de_relleno, mapa_semana_hora, zona_en
from atlas.trakt import cargar_export
from conftest import export_trakt, guardar_export


def test_hora_de_relleno_detectada_por_concentracion():
    historial = ["2010-01-0%dT01:00:00.000Z" % (i % 9 + 1) for i in range(30)] + ["2010-02-01T20:%02d:00.000Z" % i for i in range(20)]
    assert horas_de_relleno(historial) == {"01:00:00"}


def test_sin_relleno_si_ninguna_hora_domina():
    historial = ["2010-02-01T%02d:%02d:00.000Z" % (h, m) for h in range(10) for m in range(5)]
    assert horas_de_relleno(historial) == set()


def test_con_pocos_datos_no_se_descarta_nada():
    assert horas_de_relleno(["2010-01-01T01:00:00.000Z"] * 10) == set()


@pytest.mark.parametrize("fecha, zona", [
    ("2020-06-01T00:00:00Z", "America/Caracas"),
    ("2025-07-31T23:00:00Z", "America/Caracas"),
    ("2025-08-01T00:00:00Z", "Europe/Madrid"),
    ("2026-01-15T00:00:00Z", "Europe/Madrid"),
])
def test_zona_por_etapas(fecha, zona):
    assert str(zona_en(fecha)) == zona


def test_zona_con_etapas_desordenadas():
    etapas = (("2020-01-01", "Europe/Madrid"), ("2010-01-01", "America/Bogota"))
    assert str(zona_en("2015-05-05", "UTC", etapas)) == "America/Bogota"
    assert str(zona_en("2009-05-05", "UTC", etapas)) == "UTC"


def test_hora_local_caracas_y_madrid_con_horario_de_verano():
    assert a_local("2020-06-01T02:30:00Z").hour == 22  # Caracas UTC-4: noche anterior
    assert a_local("2020-06-01T02:30:00Z").day == 31
    assert a_local("2026-07-01T20:00:00Z").hour == 22  # Madrid en verano, UTC+2
    assert a_local("2026-01-15T20:00:00Z").hour == 21  # Madrid en invierno, UTC+1


def test_mapa_excluye_relleno_y_cuenta_las_horas_reales():
    reales = ["2026-01-15T20:00:00.000Z"] * 6  # jueves 21 h en Madrid
    relleno = ["2010-01-0%dT01:00:00.000Z" % (i % 9 + 1) for i in range(30)]
    mapa, con_hora = mapa_semana_hora(reales + relleno)
    assert con_hora == 6
    assert mapa[3][21] == 6
    assert sum(map(sum, mapa)) == 6


def test_stats_desempates_deterministas_y_fotos(tmp_path, md):
    # un día distinto por película: 10 en el mismo instante serían una carga en bloque
    vistas = {1000 + i: [f"2012-01-{i + 1:02d}T20:00:00.000Z"] for i in range(10)}
    vistas[1003] = ["2012-01-04T20:00:00.000Z", "2020-01-01T20:00:00.000Z"]
    vistas[1004] = ["2012-01-05T20:00:00.000Z", "2024-01-01T20:00:00.000Z"]
    ex = cargar_export(guardar_export(export_trakt(vistas), tmp_path))
    fila = md[md.tmdb == 1000].iloc[0]
    fichas = {"1000": {"d": fila.director, "dp": "/foto.jpg", "c": [], "cp": []}}
    st = calcular_stats(ex, md, fichas, {"top_actores": [], "top_directores": []})
    # repetidas: mismo nº de veces, primero la repetida más recientemente
    assert [r["id"] for r in st["rewatch"]] == [1004, 1003]
    assert st["total_vistas"] == 10 and st["match_dataset"] == 10 and st["post2017"] == 0
    conteos = [d["c"] for d in st["top_directores"]]
    assert conteos == sorted(conteos, reverse=True)
    empatados = [d["n"] for d in st["top_directores"] if d["c"] == conteos[-1]]
    assert empatados == sorted(empatados)
    assert any(d["p"] == "/foto.jpg" for d in st["top_directores"])
    assert sum(n for _, n in st["mensual"]) == st["fechados"] == ex.plays
    assert st["horas_registradas"] == sum(map(sum, st["semana_hora"]))


def test_stats_solo_con_fechas_fiables(tmp_path, md):
    vistas = {1000 + i: [f"2015-02-18T03:{40 + i}:00.000Z"] for i in range(10)}  # carga en bloque
    vistas[1020] = ["1970-01-01T00:00:00.000Z"]  # fecha desconocida
    vistas[1021] = ["2020-03-01T20:00:00.000Z"]
    ex = cargar_export(guardar_export(export_trakt(vistas), tmp_path))
    st = calcular_stats(ex, md, {}, {})
    assert st["mensual"] == [["2020-03", 1]]  # ni 1970-01 ni la barra falsa de 2015-02
    assert st["fechados"] == 1 and st["horas_registradas"] == 1
    assert st["total_vistas"] == 12  # todas cuentan como vistas


def test_repetidas_sin_fecha_van_al_final_del_empate(tmp_path, md):
    desconocida = "1970-01-01T00:00:00.000Z"
    vistas = {1001: [desconocida, desconocida], 1002: ["2012-01-01T20:00:00.000Z", "2013-01-01T20:00:00.000Z"]}
    ex = cargar_export(guardar_export(export_trakt(vistas), tmp_path))
    st = calcular_stats(ex, md, {}, {})
    assert [r["id"] for r in st["rewatch"]] == [1002, 1001]
