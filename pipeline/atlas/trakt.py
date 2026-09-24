"""Lectura del export de Trakt (zip o carpeta).

Del export salen: qué películas viste, cuándo por primera y por última vez, cuántas
veces, tus notas y el historial de visionados con su hora.

Fechas no fiables (issues 20 y 21). Un visionado cuenta como visto siempre, pero su
fecha solo se usa si es fiable. No lo es:
- la "fecha desconocida" de Trakt ("no recuerdo cuándo la vi"), que llega como el
  instante cero de Unix (1970-01-01T00:00:00Z), ni una fecha que falta o no se entiende;
- un visionado de una carga en bloque (ver config.CARGA_EN_BLOQUE_MIN): su fecha es
  la del día en que se registró, no la del día en que se vio.
"""

from __future__ import annotations

import json
import re
import zipfile
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from . import config

# Así llega en el export un visionado marcado con "fecha desconocida"
FECHA_DESCONOCIDA = datetime(1970, 1, 1, tzinfo=timezone.utc)


class ErrorExport(Exception):
    """El export no tiene lo mínimo para actualizar el atlas."""


@dataclass(frozen=True)
class Visionado:
    tmdb: int
    titulo: str
    anio: int | None
    # AAAA-MM-DD de la primera vez. None si alguno de sus visionados no tiene fecha
    # fiable: la primera vez pudo ser antes de cualquier fecha conocida.
    primera: str | None
    ultima: str | None  # AAAA-MM-DD de la última vez con fecha fiable; None si no hay ninguna
    veces: int


@dataclass(frozen=True)
class ExportTrakt:
    vistas: dict[int, Visionado]
    historial_fiable: list[str]  # marcas ISO (UTC) de los visionados de películas con fecha fiable
    sin_fecha: int  # visionados con fecha desconocida, ausente o ilegible
    en_bloque: int  # visionados registrados en una carga en bloque
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


def instante(marca: str | None) -> datetime | None:
    """Marca ISO de Trakt -> instante UTC. None si falta, no se entiende o es la fecha desconocida."""
    if not marca:
        return None
    try:
        t = datetime.fromisoformat(marca.replace("Z", "+00:00"))
    except ValueError:
        return None
    t = t if t.tzinfo else t.replace(tzinfo=timezone.utc)
    return None if t == FECHA_DESCONOCIDA else t.astimezone(timezone.utc)


def instantes_en_bloque(instantes: Iterable[datetime], minimo: int = config.CARGA_EN_BLOQUE_MIN,
                        horas: float = config.CARGA_EN_BLOQUE_HORAS) -> set[datetime]:
    """Instantes que forman parte de una carga en bloque: `minimo` o más visionados dentro
    de una ventana de `horas` (ambos extremos incluidos). Ventana deslizante, no día
    natural: una carga que cruza la medianoche también se detecta."""
    orden = sorted(instantes)
    ventana = timedelta(hours=horas)
    en_bloque: set[datetime] = set()
    inicio = 0
    for fin, t in enumerate(orden):
        while t - orden[inicio] > ventana:
            inicio += 1
        if fin - inicio + 1 >= minimo:
            en_bloque.update(orden[inicio:fin + 1])
    return en_bloque


def cargar_export(ruta: str | Path) -> ExportTrakt:
    archivos = _leer_archivos(Path(ruta))
    vistas_crudas = _paginas(archivos, "watched-movies")
    if not vistas_crudas:
        raise ErrorExport("El export no tiene watched-movies-*.json: ¿es un export completo de Trakt?")
    if "user-stats.json" not in archivos:
        raise ErrorExport("El export no tiene user-stats.json")

    descartadas: Counter[str] = Counter()

    # historial de películas: cada visionado con su instante (None si no tiene fecha fiable)
    visionados: list[tuple[int | None, str, datetime | None]] = []
    for h in _paginas(archivos, "watched-history"):
        if h.get("type") != "movie":
            continue
        tmdb = (h.get("movie") or {}).get("ids", {}).get("tmdb")
        visionados.append((tmdb, h.get("watched_at") or "", instante(h.get("watched_at"))))
    en_bloque = instantes_en_bloque(t for _, _, t in visionados if t is not None)

    def fiable(t: datetime | None) -> datetime | None:
        return t if t is not None and t not in en_bloque else None

    historial_fiable: list[str] = []
    fechas: defaultdict[int, set[str]] = defaultdict(set)  # tmdb -> días con fecha fiable
    dudosas: set[int] = set()  # películas con algún visionado sin fecha fiable
    for tmdb, marca, t in visionados:
        t_fiable = fiable(t)
        if t_fiable is not None:
            historial_fiable.append(marca)  # un visionado sin id también cuenta para los horarios
        if tmdb is None:
            descartadas["historial sin id de TMDB"] += 1
        elif t_fiable is not None:
            fechas[tmdb].add(t_fiable.date().isoformat())
        else:
            dudosas.add(tmdb)

    # watched-movies: qué películas viste y cuántas veces. Su última fecha también cuenta
    # (hay importaciones antiguas sin historial), con el mismo criterio de fiabilidad.
    datos: dict[int, dict[str, Any]] = {}
    for m in vistas_crudas:
        peli = m.get("movie") or {}
        tmdb = peli.get("ids", {}).get("tmdb")
        if tmdb is None:
            descartadas["vista sin id de TMDB"] += 1
            continue
        d = datos.setdefault(tmdb, {"veces": 0})
        d["titulo"], d["anio"] = peli.get("title") or "", peli.get("year")
        d["veces"] += int(m.get("plays") or 1)
        t_fiable = fiable(instante(m.get("last_watched_at")))
        if t_fiable is None:
            dudosas.add(tmdb)
        else:
            fechas[tmdb].add(t_fiable.date().isoformat())

    vistas: dict[int, Visionado] = {}
    for tmdb, d in datos.items():
        dias = fechas.get(tmdb, set())
        vistas[tmdb] = Visionado(
            tmdb=tmdb,
            titulo=d["titulo"],
            anio=d["anio"],
            primera=min(dias) if dias and tmdb not in dudosas else None,
            ultima=max(dias) if dias else None,
            veces=d["veces"],
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
        historial_fiable=historial_fiable,
        sin_fecha=sum(1 for _, _, t in visionados if t is None),
        en_bloque=sum(1 for _, _, t in visionados if t is not None and t in en_bloque),
        notas=notas,
        ratings=ratings,
        minutos=int(peliculas.get("minutes") or 0),
        plays=int(peliculas.get("plays") or 0),
        descartadas=dict(descartadas),
    )
