import io
import json
import urllib.error

import pytest

from atlas.puerta import revisar
from atlas.tmdb import ErrorTMDB, clave_api, completar, crear_pedidor, ficha_desde_api

CLAVE = "clave-secreta-123"


class Respuesta(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def abridor(secuencia):
    """Simula urlopen: cada llamada consume el siguiente elemento (excepción o dict)."""
    llamadas = []

    def abrir(url, timeout):
        llamadas.append(url)
        item = secuencia.pop(0)
        if isinstance(item, Exception):
            raise item
        return Respuesta(json.dumps(item).encode())
    return abrir, llamadas


def http(codigo):
    return urllib.error.HTTPError("u", codigo, "x", {}, None)


def test_reintenta_red_y_429_y_luego_responde():
    abrir, llamadas = abridor([urllib.error.URLError("caída"), http(429), {"ok": 1}])
    esperas = []
    pedir = crear_pedidor(CLAVE, abrir=abrir, dormir=esperas.append)
    assert pedir("/movie/1", {}) == {"ok": 1}
    assert len(llamadas) == 3 and esperas == [1.0, 2.0]  # espera creciente


def test_404_no_se_reintenta():
    abrir, llamadas = abridor([http(404)])
    with pytest.raises(ErrorTMDB, match="404"):
        crear_pedidor(CLAVE, abrir=abrir, dormir=lambda s: None)("/movie/1", {})
    assert len(llamadas) == 1


def test_agota_intentos_sin_filtrar_la_clave():
    abrir, _ = abridor([http(503)] * 4)
    with pytest.raises(ErrorTMDB) as e:
        crear_pedidor(CLAVE, abrir=abrir, dormir=lambda s: None)("/movie/1", {})
    assert CLAVE not in str(e.value)


def test_401_falla_sin_reintentar():
    abrir, llamadas = abridor([http(401)])
    with pytest.raises(ErrorTMDB, match="401"):
        crear_pedidor(CLAVE, abrir=abrir, dormir=lambda s: None)("/movie/1", {})
    assert len(llamadas) == 1


def test_ficha_desde_api_completa_y_con_huecos():
    d = {"original_title": "Orig", "title": "T", "release_date": "2024-05-01", "genres": [{"name": g} for g in "ABCD"],
         "runtime": 0, "vote_average": 7.26, "vote_count": 10, "poster_path": "/p.jpg", "overview": "x" * 300,
         "credits": {"crew": [{"job": "Writer", "name": "W"}, {"job": "Director", "name": "D", "profile_path": "/d.jpg"}],
                     "cast": [{"name": f"A{i}", "profile_path": None} for i in range(5)]}}
    f = ficha_desde_api(d)
    assert f["t"] == "Orig" and f["a"] == 2024 and f["g"] == ["A", "B", "C"] and f["rt"] is None
    assert f["va"] == 7.3 and len(f["o"]) == 220 and f["d"] == "D" and f["c"] == ["A0", "A1", "A2"]
    vacia = ficha_desde_api({})
    assert vacia["a"] == 0 and vacia["d"] is None and vacia["c"] == [] and vacia["t"] == ""


def test_completar_solo_pide_lo_que_falta_y_devuelve_fallos():
    cache = {"1": "ya estaba"}
    pedidos = []

    def pedir(ruta, params):
        pedidos.append(ruta)
        if ruta.endswith("/3"):
            raise ErrorTMDB("no existe")
        return {"title": ruta}

    fallidos = completar([1, 2, 3], cache, pedir, lambda t: f"/movie/{t}", {}, lambda d: d["title"], pausa=0)
    assert pedidos == ["/movie/2", "/movie/3"]
    assert cache == {"1": "ya estaba", "2": "/movie/2"}
    assert fallidos == [(3, "no existe")]


def test_clave_api(monkeypatch, tmp_path):
    monkeypatch.delenv("TMDB_API_KEY", raising=False)
    with pytest.raises(ErrorTMDB, match="Falta la clave"):
        clave_api(tmp_path / ".env")
    (tmp_path / ".env").write_text('OTRA=1\nTMDB_API_KEY="abc"\n')
    assert clave_api(tmp_path / ".env") == "abc"
    monkeypatch.setenv("TMDB_API_KEY", "de-entorno")
    assert clave_api(tmp_path / ".env") == "de-entorno"


# ---------- puerta de calidad ----------
def gusto(auc=0.9, top10=60, metodo=2, candidatos=True, clave="auc_cv"):
    return {clave: [auc, 0.01], "backtest": {"top10": top10, "metodo": metodo}, "candidatos": [{"id": 1}] if candidatos else []}


@pytest.mark.parametrize("previo, nuevo, aprobado", [
    (gusto(), gusto(), True),
    (gusto(auc=0.90), gusto(auc=0.885), True),  # caída menor que el máximo
    (gusto(auc=0.90), gusto(auc=0.87), False),
    (gusto(top10=60), gusto(top10=45), False),
    (gusto(top10=80, metodo=1), gusto(top10=60), True),  # método distinto: no se compara el backtest
    (gusto(), gusto(candidatos=False), False),
    (None, gusto(), True),
    (gusto(clave="auc_amplio"), gusto(), True),  # datos de julio con el nombre antiguo
])
def test_puerta(previo, nuevo, aprobado):
    assert revisar(previo, nuevo).aprobado is aprobado


def test_puerta_avisa_del_cambio_de_metodo():
    v = revisar(gusto(metodo=1), gusto(metodo=2))
    assert any("método" in a for a in v.avisos)
