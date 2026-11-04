"""'Porque te gustó X': favoritas y las recomendaciones de TMDB que se muestran de cada una."""

from atlas.recomendaciones import elegir_recomendaciones, favoritas, recomendaciones_desde_api

HOY = "2026-11-04"


def rec(i, fecha="2020-01-01", nv=500):
    return {"id": i, "f": fecha, "nv": nv}


def test_favoritas_por_nota_y_luego_por_lo_ultimo_que_viste():
    notas = {1: 9, 2: 8, 3: 10, 4: 7, 5: 9}
    ultima = {1: "2020-01-01", 5: "2026-10-01", 2: None}
    assert favoritas(notas, ultima, minima=8) == [3, 5, 1, 2]


def test_favoritas_empate_total_por_id_y_sin_notas():
    assert favoritas({7: 8, 3: 8}, {}, minima=8) == [3, 7]
    assert favoritas({}, {}, minima=8) == []


def test_quita_vistas_calificadas_futuras_poco_votadas_y_la_propia():
    recs = {1: [rec(10), rec(11, fecha="2027-01-01"), rec(12, nv=5), rec(13), rec(1), rec(14, fecha=""), rec(15)]}
    salida = elegir_recomendaciones([1], {1: 9}, recs, vistas={13}, calificadas={15}, hoy=HOY, votos_min=30, maximo=10)
    assert salida == [{"id": 1, "n": 9, "recs": [10]}]


def test_sin_repetir_entre_favoritas_y_con_tope():
    recs = {1: [rec(10), rec(11), rec(12)], 2: [rec(11), rec(20), rec(21)]}
    salida = elegir_recomendaciones([1, 2], {1: 10, 2: 8}, recs, vistas=set(), calificadas=set(), hoy=HOY, votos_min=30, maximo=2)
    assert salida == [{"id": 1, "n": 10, "recs": [10, 11]}, {"id": 2, "n": 8, "recs": [20, 21]}]


def test_lo_que_queda_fuera_por_el_tope_no_cuenta_como_usado():
    recs = {1: [rec(10), rec(11)], 2: [rec(11)]}
    salida = elegir_recomendaciones([1, 2], {1: 9, 2: 9}, recs, vistas=set(), calificadas=set(), hoy=HOY, votos_min=30, maximo=1)
    assert salida == [{"id": 1, "n": 9, "recs": [10]}, {"id": 2, "n": 9, "recs": [11]}]


def test_favorita_sin_recomendaciones_utiles_no_aparece():
    recs = {1: [rec(13)], 2: []}
    salida = elegir_recomendaciones([1, 2, 3], {1: 9, 2: 9, 3: 9}, recs, vistas={13}, calificadas=set(), hoy=HOY, votos_min=30, maximo=5)
    assert salida == []


def test_filtro_de_ficha():
    recs = {1: [rec(10), rec(11)]}
    salida = elegir_recomendaciones([1], {1: 9}, recs, vistas=set(), calificadas=set(), hoy=HOY, votos_min=30, maximo=5,
                                    tiene_ficha=lambda i: i != 10)
    assert salida == [{"id": 1, "n": 9, "recs": [11]}]


def test_desde_api_conserva_el_orden_y_lo_minimo():
    d = {"results": [{"id": 5, "release_date": "2024-02-01", "vote_count": 900, "title": "x"}, {"id": 6}]}
    assert recomendaciones_desde_api(d) == [{"id": 5, "f": "2024-02-01", "nv": 900}, {"id": 6, "f": "", "nv": 0}]
    assert recomendaciones_desde_api({}) == []


def test_favorita_sin_ficha_no_forma_grupo_y_libera_sus_sugerencias():
    recs = {1: [rec(10)], 2: [rec(10), rec(11)]}
    salida = elegir_recomendaciones([1, 2], {1: 10, 2: 9}, recs, vistas=set(), calificadas=set(), hoy=HOY, votos_min=30, maximo=5,
                                    tiene_ficha=lambda i: i != 1)
    assert salida == [{"id": 2, "n": 9, "recs": [10, 11]}]
