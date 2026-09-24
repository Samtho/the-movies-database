import numpy as np
import pytest

from atlas.backtest import backtest
from atlas.modelo import (auc_validacion_cruzada, coeficientes_legibles, construir_features, embeddings_texto, entrenar,
                          nombre_legible, porques)


@pytest.fixture
def E(md):
    return embeddings_texto(md, componentes=40, min_df=1)


def marcar(md, vistas, columna="visto"):
    m = md.copy()
    m[columna] = m.tmdb.isin(vistas)
    return m


def test_embeddings_deterministas(md):
    a = embeddings_texto(md, componentes=20, min_df=1)
    b = embeddings_texto(md, componentes=20, min_df=1)
    assert np.allclose(a, b)
    assert a.shape == (len(md), 20)


def test_una_pelicula_no_se_explica_a_si_misma(md, E):
    # dos películas del mismo director: una vista y otra no
    m = md.copy()
    m.loc[m.tmdb == 1000, "director"] = "Solo Uno"
    m.loc[m.tmdb == 1001, "director"] = "Solo Uno"
    m = marcar(m, {1000})
    F = construir_features(m, "visto", E)(m[m.tmdb.isin([1000, 1001])])
    aff = dict(zip(m[m.tmdb.isin([1000, 1001])].tmdb, F.aff_dir))
    assert aff[1000] == 0  # la vista no cuenta su propia dirección
    assert aff[1001] == pytest.approx(np.log1p(1))  # la no vista sí: hay 1 vista de ese director


def test_afinidad_de_reparto_resta_solo_su_propio_reparto(md, E):
    m = md.copy()
    m.at[m.index[m.tmdb == 1000][0], "cast3"] = ["Único"]  # reparto de una sola persona
    m = marcar(m, {1000})
    F = construir_features(m, "visto", E)(m[m.tmdb == 1000])
    assert F.aff_cast.iloc[0] == 0


def test_excluir_variables(md, E):
    m = marcar(md, {1000, 1001})
    F = construir_features(m, "visto", E, excluir=("log_pop", "log_votes"))(m)
    assert "log_pop" not in F.columns and "log_votes" not in F.columns and "aff_dir" in F.columns


def test_entrenamiento_determinista(md, E):
    m = marcar(md, set(md.tmdb[::4]))
    f = construir_features(m, "visto", E)
    p1 = entrenar(f, m, "visto").predict_proba(f(m).values)[:, 1]
    p2 = entrenar(f, m, "visto").predict_proba(f(m).values)[:, 1]
    assert np.array_equal(p1, p2)


def test_auc_validacion_cruzada_y_minimos(md, E):
    m = marcar(md, set(md.tmdb[::4]))
    auc, std = auc_validacion_cruzada(construir_features(m, "visto", E), m, "visto")
    assert 0 <= auc <= 1 and std >= 0
    with pytest.raises(ValueError, match="al menos 2"):
        uno = marcar(md, {1000})
        auc_validacion_cruzada(construir_features(uno, "visto", E), uno, "visto")


def test_porques_legibles_y_deterministas(md, E):
    m = marcar(md, set(md.tmdb[::3]))
    f = construir_features(m, "visto", E)
    modelo = entrenar(f, m, "visto")
    a, b = porques(modelo, f(m)), porques(modelo, f(m))
    assert a.leyenda == b.leyenda and a.por_fila == b.por_fila
    assert all(len(r) <= 3 for r in a.por_fila)
    assert all(0 <= i < len(a.leyenda) for r in a.por_fila for i in r)
    assert not any(n.startswith("txt") for n in a.leyenda)


def test_coeficientes_sin_texto_y_ordenados(md, E):
    m = marcar(md, set(md.tmdb[::3]))
    f = construir_features(m, "visto", E)
    modelo = entrenar(f, m, "visto")
    coefs = coeficientes_legibles(modelo, list(f(m).columns))
    pesos = [abs(c["w"]) for c in coefs]
    assert pesos == sorted(pesos, reverse=True)
    assert not any(c["f"].startswith("txt") for c in coefs)


@pytest.mark.parametrize("variable, esperado", [("g_Comedy", "género comedia"), ("g_Kung Fu", "género Kung Fu"), ("aff_dir", "director que ya has visto"), ("txt_3", None)])
def test_nombre_legible(variable, esperado):
    assert nombre_legible(variable) == esperado


# ---------- backtest ----------
def preparar_backtest(md, vistas_pre, vistas_post, repetidas_despues=()):
    m = md.copy()
    fechas = {t: "2010-01-01" for t in vistas_pre} | {t: "2016-01-01" for t in vistas_post}
    m["fprimera"] = m.tmdb.map(fechas)
    return m


def test_backtest_usa_la_primera_fecha(md, E):
    pre = list(md.tmdb[md.vote_count >= 100][:12])
    post = list(md.tmdb[md.vote_count >= 30][40:52])
    bt = backtest(preparar_backtest(md, pre, post), E)
    assert bt["n_test"] == len(post)
    # una película vista antes del corte (aunque se repitiera después) no es "futura"
    assert set(pre).isdisjoint(post)


def test_backtest_conservador_y_techo(md, E):
    pre = list(md.tmdb[md.vote_count >= 100][:12])
    post = list(md.tmdb[md.vote_count >= 30][40:52])
    bt = backtest(preparar_backtest(md, pre, post), E)
    assert set(bt["techo"]) == {"mediana_pct", "top10", "top20", "p100"}
    assert bt["metodo"] == 2
    assert 0 <= bt["top10"] <= 100 and bt["azar100"] > 0


def test_backtest_sin_futuro_o_sin_pasado_falla_claro(md, E):
    with pytest.raises(ValueError, match="después del corte"):
        backtest(preparar_backtest(md, list(md.tmdb[md.vote_count >= 100][:12]), []), E)
    with pytest.raises(ValueError, match="antes de"):
        backtest(preparar_backtest(md, [], list(md.tmdb[:5])), E)
