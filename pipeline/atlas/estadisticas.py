"""stats.json: tu vida en cine en números (historial, rankings, horarios)."""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

from . import config
from .trakt import ExportTrakt


def horas_de_relleno(historial: list[str], fraccion: float = config.FRACCION_HORA_RELLENO) -> set[str]:
    """Horas exactas (HH:MM:SS) que concentran más de `fraccion` del historial.

    Son visionados importados solo con fecha: su hora no es real y no deben pintar el
    mapa día × hora. Con pocos datos (menos de 20 visionados) no se descarta nada.
    """
    if len(historial) < 20:
        return set()
    cuenta = Counter(h[11:19] for h in historial if len(h) >= 19)
    return {hora for hora, n in cuenta.items() if n / len(historial) > fraccion}


def zona_en(fecha_iso: str, inicial: str = config.ZONA_INICIAL, etapas: tuple[tuple[str, str], ...] = config.ZONAS_POR_ETAPA) -> ZoneInfo:
    """Zona horaria vigente en esa fecha según las etapas (cada una desde su fecha, inclusive)."""
    zona = inicial
    for desde, nombre in sorted(etapas):
        if fecha_iso[:10] >= desde:
            zona = nombre
    return ZoneInfo(zona)


def a_local(marca_utc: str) -> datetime:
    utc = datetime.fromisoformat(marca_utc.replace("Z", "+00:00"))
    return utc.astimezone(zona_en(marca_utc))


def mapa_semana_hora(historial: list[str]) -> tuple[list[list[int]], int]:
    """Visionados por día de la semana (lunes=0) y hora local; y cuántos tenían hora real."""
    relleno = horas_de_relleno(historial)
    mapa = [[0] * 24 for _ in range(7)]
    con_hora = 0
    for h in historial:
        if h[11:19] in relleno:
            continue
        local = a_local(h)
        mapa[local.weekday()][local.hour] += 1
        con_hora += 1
    return mapa, con_hora


def _negar_fecha(iso: str) -> tuple[int, ...]:
    """Clave de orden descendente para fechas AAAA-MM-DD."""
    return tuple(-int(x) for x in iso.split("-"))


def _top(cuenta: Counter[str], n: int) -> list[tuple[str, int]]:
    # empate: por nombre, para que el ranking no cambie entre ejecuciones
    return sorted(cuenta.items(), key=lambda x: (-x[1], x[0]))[:n]


def _fotos_de_personas(fichas: dict[str, Any]) -> dict[str, str]:
    """Primera foto conocida de cada persona (dirección o reparto) en las fichas."""
    fotos: dict[str, str] = {}
    for f in fichas.values():
        if f.get("d") and f.get("dp") and f["d"] not in fotos:
            fotos[f["d"]] = f["dp"]
        for nombre, foto in zip(f.get("c", []), f.get("cp") or []):
            if foto and nombre not in fotos:
                fotos[nombre] = foto
    return fotos


def calcular_stats(export: ExportTrakt, md: pd.DataFrame, fichas: dict[str, Any], stats_previas: dict[str, Any] | None = None) -> dict[str, Any]:
    vistas_md = md[md.tmdb.isin(export.vistas)]
    match = int(len(vistas_md))
    mensual = Counter(h[:7] for h in export.historial)
    semana_hora, con_hora = mapa_semana_hora(export.historial)
    decadas = Counter((v.anio // 10) * 10 for v in export.vistas.values() if v.anio and v.anio > 0)
    # más vistas primero; empate: la repetida más recientemente, luego por título
    repetidas = sorted((v for v in export.vistas.values() if v.veces > 1), key=lambda v: (-v.veces, _negar_fecha(v.ultima), v.titulo))[:14]

    # fotos: se conservan las ya publicadas y se completan con las de las fichas
    fotos = _fotos_de_personas(fichas)
    for clave in ("top_directores", "top_actores"):
        for d in (stats_previas or {}).get(clave, []):
            if d.get("p"):
                fotos[d["n"]] = d["p"]

    directores = Counter(d for d in vistas_md.director if isinstance(d, str) and d)
    actores = Counter(a for reparto in vistas_md.cast3 for a in reparto)
    generos = Counter(g for lista in vistas_md.genres_l for g in lista)
    return {
        "total_vistas": len(export.vistas),
        "plays": export.plays,
        "minutos": export.minutos,
        "match_dataset": match,
        "post2017": len(export.vistas) - match,
        "mensual": sorted([m, n] for m, n in mensual.items()),
        "semana_hora": semana_hora,
        "horas_registradas": con_hora,
        "decadas": sorted([d, n] for d, n in decadas.items()),
        "rewatch": [{"t": v.titulo, "a": v.anio, "n": v.veces, "id": v.tmdb} for v in repetidas],
        "top_directores": [{"n": n, "c": c, "p": fotos.get(n)} for n, c in _top(directores, 12)],
        "top_actores": [{"n": n, "c": c, "p": fotos.get(n)} for n, c in _top(actores, 12)],
        "top_generos": [{"n": n, "c": c} for n, c in _top(generos, 12)],
        "ratings": export.ratings,
    }
