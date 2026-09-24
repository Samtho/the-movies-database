"""Lectura del export de Trakt (zip o carpeta).

Del export salen: qué películas viste, cuándo por primera y por última vez, cuántas
veces, tus notas y el historial de visionados con su hora.
"""

from __future__ import annotations

import json
import re
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ErrorExport(Exception):
    """El export no tiene lo mínimo para actualizar el atlas."""


@dataclass(frozen=True)
class Visionado:
    tmdb: int
    titulo: str
    anio: int | None
    primera: str  # AAAA-MM-DD, primera vez que la viste
    ultima: str  # AAAA-MM-DD, última vez
    veces: int


@dataclass(frozen=True)
class ExportTrakt:
    vistas: dict[int, Visionado]
    historial: list[str]  # marcas de tiempo ISO (UTC) de cada visionado de película
    notas: dict[int, int]  # tmdb -> nota 1..10
    ratings: list[dict[str, Any]]  # para stats: {t, r, id}
    minutos: int
    plays: int
    descartadas: dict[str, int] = field(default_factory=dict)  # motivo -> cuántas


def _leer_archivos(ruta: Path) -> dict[str, Any]:
    """Nombre de archivo -> JSON, desde un zip o una carpeta (ignora subcarpetas)."""
    if not ruta.exists():
        raise ErrorExport(f"No existe el export de Trakt: {ruta}")
    archivos: dict[str, Any] = {}
    if ruta.is_file() and ruta.suffix == ".zip":
        with zipfile.ZipFile(ruta) as z:
            for nombre in z.namelist():
                if nombre.endswith(".json"):
                    archivos[Path(nombre).name] = json.loads(z.read(nombre))
    elif ruta.is_dir():
        for p in ruta.glob("*.json"):
            archivos[p.name] = json.loads(p.read_text(encoding="utf-8"))
    else:
        raise ErrorExport(f"El export debe ser un .zip o una carpeta: {ruta}")
    return archivos


def _paginas(archivos: dict[str, Any], prefijo: str) -> list[Any]:
    """Une las páginas numeradas (watched-movies-1.json, -2...) en orden numérico."""
    patron = re.compile(rf"^{re.escape(prefijo)}-(\d+)\.json$")
    paginas = sorted(((int(m.group(1)), n) for n in archivos if (m := patron.match(n))))
    salida: list[Any] = []
    for _, nombre in paginas:
        salida.extend(archivos[nombre])
    return salida


def cargar_export(ruta: str | Path) -> ExportTrakt:
    archivos = _leer_archivos(Path(ruta))
    vistas_crudas = _paginas(archivos, "watched-movies")
    if not vistas_crudas:
        raise ErrorExport("El export no tiene watched-movies-*.json: ¿es un export completo de Trakt?")
    if "user-stats.json" not in archivos:
        raise ErrorExport("El export no tiene user-stats.json")

    descartadas: Counter[str] = Counter()

    # historial de películas: primera fecha por película y horas de cada visionado
    primeras: dict[int, str] = {}
    historial: list[str] = []
    for h in _paginas(archivos, "watched-history"):
        if h.get("type") != "movie":
            continue
        tmdb = (h.get("movie") or {}).get("ids", {}).get("tmdb")
        cuando = h.get("watched_at")
        if not cuando:
            descartadas["historial sin fecha"] += 1
            continue
        historial.append(cuando)
        if tmdb is None:
            descartadas["historial sin id de TMDB"] += 1
            continue
        dia = cuando[:10]
        if tmdb not in primeras or dia < primeras[tmdb]:
            primeras[tmdb] = dia

    vistas: dict[int, Visionado] = {}
    for m in vistas_crudas:
        peli = m.get("movie") or {}
        tmdb = peli.get("ids", {}).get("tmdb")
        ultima = (m.get("last_watched_at") or "")[:10]
        if tmdb is None:
            descartadas["vista sin id de TMDB"] += 1
            continue
        if not ultima:
            descartadas["vista sin fecha"] += 1
            continue
        previa = vistas.get(tmdb)
        veces = int(m.get("plays") or 1) + (previa.veces if previa else 0)
        # si el historial no la tiene (pasa con importaciones antiguas), la primera es la última conocida
        primera = min(primeras.get(tmdb, ultima), previa.primera if previa else ultima)
        vistas[tmdb] = Visionado(
            tmdb=tmdb,
            titulo=peli.get("title") or "",
            anio=peli.get("year"),
            primera=primera,
            ultima=max(ultima, previa.ultima) if previa else ultima,
            veces=veces,
        )

    ratings_crudos = archivos.get("ratings-movies.json", [])
    notas: dict[int, int] = {}
    ratings: list[dict[str, Any]] = []
    for r in ratings_crudos:
        peli = r.get("movie") or {}
        tmdb = peli.get("ids", {}).get("tmdb")
        ratings.append({"t": peli.get("title") or "", "r": int(r["rating"]), "id": tmdb})
        if tmdb is not None:
            notas[tmdb] = int(r["rating"])

    peliculas = archivos["user-stats.json"].get("movies", {})
    return ExportTrakt(
        vistas=vistas,
        historial=historial,
        notas=notas,
        ratings=ratings,
        minutos=int(peliculas.get("minutes") or 0),
        plays=int(peliculas.get("plays") or 0),
        descartadas=dict(descartadas),
    )
