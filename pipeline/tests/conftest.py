"""Datos sintéticos para los tests del pipeline: un dataset pequeño y un export de Trakt falso.

Nunca se usan tus datos reales: los tests corren en CI sin nada personal.
"""

from __future__ import annotations

import json
import random
import zipfile
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

GENEROS = ["Drama", "Comedy", "Action", "Horror", "Romance", "Science Fiction"]
DIRECTORES = [f"Director {i}" for i in range(20)]
ACTORES = [f"Actor {i}" for i in range(40)]
VOCABULARIO = [f"palabra{i}" for i in range(400)]


def dataset_sintetico(n: int = 160, semilla: int = 7) -> pd.DataFrame:
    r = random.Random(semilla)
    filas = []
    for i in range(n):
        tmdb = 1000 + i
        filas.append({
            "tmdb": tmdb,
            "title": f"Película {i}",
            "year": float(r.randint(1960, 2017)),
            "overview": " ".join(r.choices(VOCABULARIO, k=30)),
            "genres_l": r.sample(GENEROS, r.randint(1, 3)),
            "kw_l": r.sample(VOCABULARIO, 5),
            "director": r.choice(DIRECTORES),
            "cast3": r.sample(ACTORES, 3),
            "runtime": float(r.randint(80, 180)),
            "vote_average": round(r.uniform(4, 9), 1),
            "vote_count": float(r.choice([40, 120, 300, 1500])),
            "popularity": r.uniform(0.5, 30),
            "original_language": r.choice(["en", "en", "es", "fr"]),
        })
    return pd.DataFrame(filas)


def export_trakt(vistas: dict[int, list[str]], notas: dict[int, int] | None = None, titulo=lambda t: f"Película {t - 1000}",
                 historial_extra: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Archivos de un export: `vistas` es tmdb -> lista de marcas ISO de cada visionado."""
    watched, historial = [], []
    for tmdb, marcas in vistas.items():
        watched.append({"last_watched_at": max(marcas), "plays": len(marcas),
                        "movie": {"title": titulo(tmdb), "year": 2000, "ids": {"tmdb": tmdb}}})
        historial += [{"type": "movie", "watched_at": m, "movie": {"title": titulo(tmdb), "ids": {"tmdb": tmdb}}} for m in marcas]
    historial += historial_extra or []
    mitad = len(watched) // 2 or 1
    return {
        "watched-movies-1.json": watched[:mitad],
        "watched-movies-2.json": watched[mitad:],
        "watched-history-1.json": historial,
        "ratings-movies.json": [{"rating": nota, "movie": {"title": titulo(t), "ids": {"tmdb": t}}} for t, nota in (notas or {}).items()],
        "user-stats.json": {"movies": {"plays": len(historial), "minutes": 120 * len(historial)}},
    }


def guardar_export(archivos: dict[str, Any], destino: Path, como_zip: bool = True) -> Path:
    if como_zip:
        ruta = destino / "export.zip"
        with zipfile.ZipFile(ruta, "w") as z:
            for nombre, contenido in archivos.items():
                z.writestr(f"trakt-export-x/{nombre}", json.dumps(contenido))
        return ruta
    carpeta = destino / "export"
    carpeta.mkdir()
    for nombre, contenido in archivos.items():
        (carpeta / nombre).write_text(json.dumps(contenido))
    return carpeta


@pytest.fixture
def md() -> pd.DataFrame:
    return dataset_sintetico()
