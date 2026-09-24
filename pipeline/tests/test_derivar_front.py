import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from derivar_front import (  # noqa: E402
    con_posters_rewatch,
    derivar,
    muro_portada,
    resumen,
    sanear_similares,
)


@pytest.mark.parametrize(
    "entrada, esperado",
    [
        ({"1": [2, 3]}, {"1": [2, 3]}),  # sin cambios
        ({"1": [1, 2, 3]}, {"1": [2, 3]}),  # autorreferencia al inicio
        ({"1": [2, 1, 3]}, {"1": [2, 3]}),  # autorreferencia en medio
        ({"1": [2, 2, 3, 2]}, {"1": [2, 3]}),  # duplicados
        ({"1": [1]}, {"1": []}),  # solo ella misma
        ({"1": []}, {"1": []}),  # lista vacía
        ({}, {}),  # sin películas
    ],
)
def test_sanear_similares(entrada, esperado):
    assert sanear_similares(entrada) == esperado


def test_sanear_similares_es_idempotente():
    una = sanear_similares({"5": [5, 6, 6, 7]})
    assert sanear_similares(una) == una


FICHAS = {"1": {"p": "/a.jpg"}, "2": {"p": None}, "3": {"p": "/c.jpg"}, "4": {"p": "/d.jpg"}}


def test_posters_rewatch_con_y_sin_ficha():
    rew = [{"id": 1, "n": 3}, {"id": 2, "n": 2}, {"id": 99, "n": 2}, {"id": None, "n": 2}]
    assert [r["p"] for r in con_posters_rewatch(rew, FICHAS)] == ["/a.jpg", None, None, None]
    assert con_posters_rewatch(rew, FICHAS)[0]["n"] == 3  # conserva el resto de campos


def test_muro_orden_sin_duplicados_ni_huecos():
    stats = {"rewatch": [{"id": 3}, {"id": 2}, {"id": 1}], "ratings": [{"id": 1}, {"id": 4}, {"id": None}]}
    assert muro_portada(stats, FICHAS) == [{"id": 3, "p": "/c.jpg"}, {"id": 1, "p": "/a.jpg"}, {"id": 4, "p": "/d.jpg"}]


def test_muro_respeta_el_maximo():
    fichas = {str(i): {"p": f"/{i}.jpg"} for i in range(50)}
    stats = {"rewatch": [{"id": i} for i in range(50)], "ratings": []}
    assert len(muro_portada(stats, fichas, maximo=28)) == 28


def test_muro_vacio_sin_datos():
    assert muro_portada({"rewatch": [], "ratings": []}, FICHAS) == []
    assert muro_portada({}, FICHAS) == []


def test_resumen():
    gusto = {"auc_amplio": [0.90818, 0.01072], "benchmark": {"a": {}, "b": {}, "c": {}}}
    assert resumen([{}, {}], gusto) == {"universo": 2, "auc": 0.908, "auc_std": 0.011, "modelos": 3}


def test_derivar_de_punta_a_punta(tmp_path: Path):
    datos = {
        "fichas": FICHAS,
        "stats": {"rewatch": [{"id": 1, "n": 2}], "ratings": [{"id": 3}]},
        "similares": {"1": [1, 3], "3": [1]},
        "galaxia": [{}, {}, {}],
        "gusto": {"auc_amplio": [0.9, 0.01], "benchmark": {"x": {}}},
    }
    for nombre, contenido in datos.items():
        (tmp_path / f"{nombre}.json").write_text(json.dumps(contenido))
    derivar(tmp_path)
    derivar(tmp_path)  # idempotente
    stats = json.loads((tmp_path / "stats.json").read_text())
    assert stats["muro"] == [{"id": 1, "p": "/a.jpg"}, {"id": 3, "p": "/c.jpg"}]
    assert stats["rewatch"][0]["p"] == "/a.jpg"
    assert stats["resumen"] == {"universo": 3, "auc": 0.9, "auc_std": 0.01, "modelos": 1}
    assert json.loads((tmp_path / "similares.json").read_text()) == {"1": [3], "3": [1]}
