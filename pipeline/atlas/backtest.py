"""Backtest temporal: ¿el modelo entrenado con el pasado anticipa lo que viste después?

Reglas contra la trampa (issue 12 y 19):
- La fecha que decide "antes o después del corte" es la PRIMERA vez que viste la
  película. Con la última, lo visto en 2010 y repetido en 2016 contaba como descubrimiento futuro.
- La afinidad con dirección y reparto solo cuenta lo visto antes del corte.
- Votos y popularidad del dataset están medidos en 2017 (después del corte): el
  resultado "conservador" los excluye; el "techo" los incluye. La verdad está entre ambos.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from . import config
from .modelo import construir_features, entrenar


def _ranking(md: pd.DataFrame, E: np.ndarray, corte: str, excluir: tuple[str, ...]) -> pd.DataFrame:
    m = md.copy()
    m["visto_pre"] = m.fprimera.notna() & (m.fprimera < corte)
    m["visto_post"] = m.fprimera.notna() & (m.fprimera >= corte)
    features = construir_features(m, "visto_pre", E, excluir=excluir)
    # lo visto después del corte no entra en el entrenamiento: sería mirar el examen
    entreno = m[(m.vote_count >= config.VOTOS_MIN_ENTRENO) & (~m.visto_post)]
    if entreno.visto_pre.sum() < 2:
        raise ValueError(f"Menos de 2 películas vistas antes de {corte}: no hay con qué entrenar el backtest")
    modelo = entrenar(features, entreno, "visto_pre")
    cand = m[(m.vote_count >= config.VOTOS_MIN_CANDIDATA) & (~m.visto_pre)].copy()
    cand["s"] = modelo.predict_proba(features(cand).values)[:, 1]
    # desempate por id: el ranking no depende del orden de las filas
    cand = cand.sort_values(["s", "tmdb"], ascending=[False, True]).reset_index(drop=True)
    cand["pct"] = (cand.index + 1) / len(cand) * 100
    return cand


def _metricas(cand: pd.DataFrame) -> dict[str, Any]:
    prueba = cand[cand.visto_post]
    n = len(prueba)
    if n == 0:
        raise ValueError("Ninguna película vista después del corte: el backtest no tiene con qué medirse")
    return {
        "n_test": int(n),
        "n_cand": int(len(cand)),
        "mediana_pct": round(float(prueba.pct.median()), 1),
        "top10": int(round(float((prueba.pct <= 10).mean() * 100))),
        "top20": int(round(float((prueba.pct <= 20).mean() * 100))),
        "p100": int(cand.head(100).visto_post.sum()),
        "p300": int(cand.head(300).visto_post.sum()),
        "p500": int(cand.head(500).visto_post.sum()),
        "azar100": round(n / len(cand) * 100, 1),
    }


def backtest(md: pd.DataFrame, E: np.ndarray, corte: str = config.CORTE_BACKTEST) -> dict[str, Any]:
    """Resultado conservador (sin variables medidas en el futuro) con el techo al lado."""
    conservador = _metricas(_ranking(md, E, corte, config.VARIABLES_CON_FUTURO))
    techo = _metricas(_ranking(md, E, corte, ()))
    return {
        "corte": corte,
        **conservador,
        "techo": {k: techo[k] for k in ("mediana_pct", "top10", "top20", "p100")},
        "metodo": config.VERSION_METODO,
    }
