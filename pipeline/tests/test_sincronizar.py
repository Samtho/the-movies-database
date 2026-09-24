import pytest

from atlas.sincronizar import (ErrorSincronizacion, Informe, sincronizar_fichas, sincronizar_galaxia,
                               sincronizar_grafo)

FICHA = {"t": "Vieja", "a": 2000, "g": ["Drama"], "d": "Ana", "dp": None, "c": ["Luis"], "cp": [None], "rt": 90, "va": 7.0, "nv": 10, "p": None, "o": ""}
CACHE_NUEVA = {"t": "Nueva", "a": 2025, "g": ["Comedy"], "d": "Ana", "dp": "/ana.jpg", "c": ["Luis", "Eva"], "cp": ["/l.jpg", None], "rt": 100, "va": 6.5, "nv": 50, "p": "/n.jpg", "o": "Sinopsis"}


def test_fichas_marca_vistas_y_crea_las_nuevas_desde_la_cache():
    inf = Informe()
    fichas = {"1": {**FICHA, "v": 0}, "2": {**FICHA, "v": 1}}
    out = sincronizar_fichas(fichas, {1, 9}, {"9": CACHE_NUEVA}, {}, inf)
    assert (out["1"]["v"], out["2"]["v"], out["9"]["v"]) == (1, 0, 1)
    assert out["9"]["reciente"] == 1 and out["9"]["t"] == "Nueva"
    assert inf.fichas_nuevas == [9] and inf.fichas_cambiadas == 2
    assert fichas["1"]["v"] == 0  # no muta la entrada


def test_fichas_falla_si_una_vista_no_tiene_ficha_ni_cache():
    with pytest.raises(ErrorSincronizacion, match="atlas.tmdb"):
        sincronizar_fichas({}, {5}, {}, {}, Informe())


def test_fichas_cache_incompleta_falla_claro():
    with pytest.raises(ErrorSincronizacion, match="incompleta"):
        sincronizar_fichas({}, {5}, {"5": {"t": "x"}}, {}, Informe())


def test_fichas_cache_con_nulos_se_normaliza():
    out = sincronizar_fichas({}, {5}, {"5": {**CACHE_NUEVA, "o": None, "cp": None, "nv": None}}, {}, Informe())
    assert out["5"]["o"] == "" and out["5"]["cp"] == [None, None] and out["5"]["nv"] == 0


def test_titulo_en_espanol_solo_si_es_distinto():
    inf = Informe()
    out = sincronizar_fichas({"1": {**FICHA, "v": 0}, "2": {**FICHA, "t": "Igual", "v": 0}}, set(), {}, {"1": "La Vieja", "2": "Igual"}, inf)
    assert out["1"]["te"] == "La Vieja" and "te" not in out["2"] and inf.titulos_es == 1


def test_galaxia():
    inf = Informe()
    out = sincronizar_galaxia([{"id": 1, "v": 0}, {"id": 2, "v": 1}], {1}, inf)
    assert [p["v"] for p in out] == [1, 0] and inf.galaxia_cambiadas == 2


def grafo_base():
    return {
        "nodes": [
            {"t": "d", "l": "Ana", "v": 1, "x": 0.0, "y": 0.0, "f": None},
            {"t": "a", "l": "Luis", "v": 1, "x": 10.0, "y": 0.0, "f": None},
            {"t": "m", "id": 1, "l": "Vieja", "a": 2000, "v": 1, "p": None, "x": 5.0, "y": 5.0},
        ],
        "links": [[2, 0], [2, 1]],
    }


def test_grafo_engancha_la_nueva_a_sus_personas_y_recuenta():
    inf = Informe()
    fichas = {"1": {**FICHA, "v": 1}, "9": {**CACHE_NUEVA, "v": 1}}
    out = sincronizar_grafo(grafo_base(), fichas, {1, 9}, inf)
    nuevo = out["nodes"][-1]
    assert nuevo["id"] == 9 and nuevo["v"] == 1 and inf.grafo_nodos_nuevos == [9]
    assert sorted(b for a, b in out["links"] if a == 3) == [0, 1]  # Ana y Luis; Eva no está en el grafo
    assert out["nodes"][0]["v"] == 2 and out["nodes"][1]["v"] == 2  # cada persona: 2 vistas


def test_grafo_desmarca_y_no_engancha_huerfanas():
    inf = Informe()
    fichas = {"1": {**FICHA, "v": 0}, "8": {**CACHE_NUEVA, "d": "Nadie", "c": ["Otro"], "v": 1}}
    out = sincronizar_grafo(grafo_base(), fichas, {8}, inf)
    assert out["nodes"][2]["v"] == 0
    assert out["nodes"][0]["v"] == 0
    assert inf.grafo_sin_personas == [8] and len(out["nodes"]) == 3


def test_grafo_es_determinista():
    fichas = {"1": {**FICHA, "v": 1}, "9": {**CACHE_NUEVA, "v": 1}}
    assert sincronizar_grafo(grafo_base(), fichas, {1, 9}, Informe()) == sincronizar_grafo(grafo_base(), fichas, {1, 9}, Informe())
