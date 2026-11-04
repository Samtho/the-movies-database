"""Tus notas en el ranking: cuánto se parece cada candidata a lo que calificaste.

El modelo de gusto predice qué verías (señal implícita). Las notas dicen qué te gustó,
pero son pocas para entrenar un modelo propio (la segunda etapa pide 150 dentro del
dataset). Esto funciona con todas, también con las de películas posteriores a 2017:

- Cada nota pesa `nota - NOTA_NEUTRA`: un 9 suma 2, un 5 resta 2, el 7 no cuenta.
- La afinidad de una candidata es la media ponderada de su parecido (coseno en el
  espacio de texto: sinopsis, géneros y keywords) con cada película calificada.
- Antes de usarla se valida: dejando fuera cada nota, ¿la afinidad con las demás
  ordena tus notas? (correlación de Spearman). Solo se aplica si la señal supera lo
  que daría el azar con ese número de notas (senal_suficiente).
"""

from __future__ import annotations

import numpy as np


def _unitarias(M: np.ndarray) -> np.ndarray:
    norma = np.linalg.norm(M, axis=1, keepdims=True)
    return np.divide(M, norma, out=np.zeros_like(M, dtype=float), where=norma > 0)


def afinidad(C: np.ndarray, R: np.ndarray, w: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Afinidad de cada candidata (filas de C) con las calificadas (filas de R, pesos w).

    Devuelve la afinidad y, por candidata, el índice de la calificada que más la sube
    (-1 si ninguna suma: no hay "parecida a" que contar).
    """
    if len(R) == 0 or not np.abs(w).sum():
        return np.zeros(len(C)), np.full(len(C), -1)
    aporte = (_unitarias(C) @ _unitarias(R).T) * w
    mejor = aporte.argmax(axis=1)
    mejor[aporte.max(axis=1) <= 0] = -1
    return aporte.sum(axis=1) / np.abs(w).sum(), mejor


def spearman(a: np.ndarray, b: np.ndarray) -> float | None:
    """Correlación de rangos (empates con rango medio). None si no se puede calcular."""
    if len(a) < 3:
        return None
    ra = _rangos(np.asarray(a, dtype=float))
    rb = _rangos(np.asarray(b, dtype=float))
    if ra.std() == 0 or rb.std() == 0:
        return None
    return float(np.corrcoef(ra, rb)[0, 1])


def _rangos(x: np.ndarray) -> np.ndarray:
    orden = x.argsort(kind="stable")
    rangos = np.empty(len(x))
    rangos[orden] = np.arange(len(x), dtype=float)
    for valor in np.unique(x):  # empates: rango medio
        iguales = x == valor
        rangos[iguales] = rangos[iguales].mean()
    return rangos


def validar(R: np.ndarray, notas: np.ndarray, neutra: int) -> float | None:
    """Spearman entre cada nota y la afinidad de su película con las DEMÁS calificadas."""
    w = notas.astype(float) - neutra
    U = _unitarias(R)
    aporte = (U @ U.T) * w
    np.fill_diagonal(aporte, 0)  # una película no se predice a sí misma
    total = np.abs(w).sum() - np.abs(w)
    loo = np.divide(aporte.sum(axis=1), total, out=np.zeros(len(w)), where=total > 0)
    return spearman(loo, notas)


def nota_ponderada(va: np.ndarray, votos: np.ndarray, votos_prior: float) -> np.ndarray:
    """Nota media de TMDB encogida hacia la media general según cuántos votos tiene.

    Un 8,5 con 35 votos dice poco; uno con 5.000, mucho. Con votos_prior votos, la nota
    queda a medio camino entre la suya y la media. Sin nota (NaN), vale la media.
    """
    va = np.asarray(va, dtype=float)
    votos = np.nan_to_num(np.asarray(votos, dtype=float))
    media = np.nanmean(va) if np.isfinite(va).any() else 0.0
    va = np.where(np.isfinite(va), va, media)
    return (votos * va + votos_prior * media) / (votos + votos_prior)


def senal_suficiente(rho: float | None, n: int, minimo: int) -> bool:
    """¿La validación muestra señal real? Con n notas, el azar da |rho| de hasta ~2/raíz(n-1)
    (dos errores estándar): por debajo de eso, aplicar la afinidad sería ordenar por ruido."""
    return rho is not None and n >= max(minimo, 2) and rho >= 2 / np.sqrt(n - 1)


def combinar(p: np.ndarray, aff: np.ndarray, peso: float) -> np.ndarray:
    """Suma la afinidad (estandarizada) al logit de P(ver): el orden mezcla elección y gusto."""
    q = np.clip(p, 1e-6, 1 - 1e-6)
    return 1 / (1 + np.exp(-(np.log(q / (1 - q)) + peso * estandarizada(aff))))


def estandarizada(aff: np.ndarray) -> np.ndarray:
    """Media 0 y desviación 1 (todo ceros si no hay variación)."""
    sd = aff.std()
    return (aff - aff.mean()) / sd if sd > 0 else np.zeros_like(aff)
