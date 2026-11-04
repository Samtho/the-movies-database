import numpy as np
import pytest

from atlas.modelo import ajustar_texto, embeddings_texto, texto_pelicula
from atlas.notas import afinidad, combinar, estandarizada, nota_ponderada, senal_suficiente, spearman, validar


def test_afinidad_sube_lo_parecido_a_lo_que_te_gusto_y_baja_lo_otro():
    R = np.array([[1.0, 0.0], [0.0, 1.0]])  # te gustó la primera, no la segunda
    w = np.array([2.0, -2.0])
    C = np.array([[3.0, 0.0], [0.0, 5.0], [1.0, 1.0]])
    aff, mejor = afinidad(C, R, w)
    assert aff[0] > aff[2] > aff[1]
    assert aff[2] == pytest.approx(0.0)
    assert list(mejor) == [0, -1, 0]  # la segunda solo se parece a una que no te gustó


def test_afinidad_sin_calificadas_o_con_filas_vacias():
    C = np.array([[1.0, 0.0], [0.0, 0.0]])
    aff, mejor = afinidad(C, np.empty((0, 2)), np.array([]))
    assert list(aff) == [0.0, 0.0] and list(mejor) == [-1, -1]
    aff, mejor = afinidad(C, np.array([[1.0, 0.0]]), np.array([1.0]))
    assert list(aff) == [1.0, 0.0]  # una fila de ceros no rompe el coseno
    assert list(mejor) == [0, -1]


def test_spearman_con_empates_y_casos_sin_calculo():
    assert spearman(np.array([1, 2, 3, 4]), np.array([10, 20, 30, 40])) == pytest.approx(1.0)
    assert spearman(np.array([1, 2, 3, 4]), np.array([4, 3, 2, 1])) == pytest.approx(-1.0)
    assert spearman(np.array([1, 1, 2, 2]), np.array([1, 1, 2, 2])) == pytest.approx(1.0)
    assert spearman(np.array([1, 2]), np.array([1, 2])) is None
    assert spearman(np.array([1, 2, 3]), np.array([5, 5, 5])) is None


def test_validar_detecta_senal_y_su_ausencia():
    # dos grupos de contenido: lo que se parece a lo que te gustó también te gustó
    R = np.array([[1, 0.1], [1, 0.0], [0.9, 0.1], [0.0, 1], [0.1, 1], [0.0, 0.9]])
    notas = np.array([9, 10, 9, 4, 5, 4])
    assert validar(R, notas, neutra=7) > 0.5
    # notas repartidas sin relación con el contenido: no hay señal que aprovechar
    assert validar(R, np.array([9, 4, 9, 4, 9, 4]), neutra=7) < 0.5


def test_validar_no_usa_la_propia_nota():
    # dos películas idénticas en contenido y con notas opuestas: sin la propia, cada una ve la contraria
    R = np.array([[1.0, 0.0], [1.0, 0.0], [0.0, 1.0]])
    assert validar(R, np.array([10, 4, 7]), neutra=7) < 0


def test_combinar_respeta_el_rango_y_el_orden():
    p = np.array([0.9, 0.9, 0.5, 0.0, 1.0])
    aff = np.array([1.0, -1.0, 0.0, 0.0, 0.0])
    s = combinar(p, aff, peso=1.0)
    assert ((s > 0) & (s < 1)).all()
    assert s[0] > s[1]  # misma P(ver): gana la más afín
    assert np.allclose(combinar(p, np.zeros(5), peso=1.0), np.clip(p, 1e-6, 1 - 1e-6))  # sin variación no cambia nada
    assert np.allclose(combinar(p, aff, peso=0.0), np.clip(p, 1e-6, 1 - 1e-6))


def test_estandarizada():
    z = estandarizada(np.array([1.0, 2.0, 3.0]))
    assert z.mean() == pytest.approx(0) and z.std() == pytest.approx(1)
    assert list(estandarizada(np.array([2.0, 2.0]))) == [0.0, 0.0]


def test_texto_pelicula_coincide_con_el_del_dataset(md):
    fila = md.iloc[0]
    esperado = fila.overview + " " + " ".join(fila.genres_l) + " " + " ".join(fila.kw_l) * 2
    assert texto_pelicula(fila.overview, fila.genres_l, fila.kw_l) == esperado


def test_proyectar_coloca_una_pelicula_del_dataset_casi_en_su_sitio(md):
    espacio = ajustar_texto(md, componentes=20, min_df=1)
    assert np.allclose(espacio.E, embeddings_texto(md, componentes=20, min_df=1))
    fila = md.iloc[3]
    v = espacio.proyectar([texto_pelicula(fila.overview, fila.genres_l, fila.kw_l)])[0]
    coseno = v @ espacio.E[3] / (np.linalg.norm(v) * np.linalg.norm(espacio.E[3]))
    assert coseno > 0.99


def test_senal_suficiente_exige_superar_al_azar():
    assert senal_suficiente(0.30, 88, minimo=20)  # umbral ~0.214
    assert not senal_suficiente(0.053, 88, minimo=20)  # tu contenido en noviembre de 2026: ruido
    assert not senal_suficiente(0.9, 10, minimo=20)  # pocas notas
    assert not senal_suficiente(None, 88, minimo=20)
    assert not senal_suficiente(-0.5, 88, minimo=20)
    assert not senal_suficiente(1.0, 1, minimo=0)  # sin división por cero


def test_nota_ponderada_encoge_las_notas_con_pocos_votos():
    va = np.array([9.0, 9.0, 5.0, np.nan])
    votos = np.array([10_000, 0, 100, 50])
    r = nota_ponderada(va, votos, votos_prior=100)
    media = 23 / 3
    assert r[0] == pytest.approx((10_000 * 9 + 100 * media) / 10_100)
    assert r[1] == pytest.approx(media)  # sin votos: la media
    assert r[2] == pytest.approx((5 + media) / 2)  # tantos votos como el prior: a medio camino
    assert r[3] == pytest.approx(media)  # sin nota: la media
    assert r[0] > r[2]


def test_nota_ponderada_sin_ninguna_nota():
    assert list(nota_ponderada(np.array([np.nan]), np.array([5]), votos_prior=100)) == [0.0]
