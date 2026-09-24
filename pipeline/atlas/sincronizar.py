"""Sincroniza el "universo 2017 congelado" con tu historial nuevo (decisión 16B).

La galaxia, las similares y la industria no cambian (el dataset no cambia). Lo que sí
cambia al refrescar es qué has visto, y eso vive repartido en tres archivos:
- fichas.json: v=1 en las vistas; fichas nuevas para las vistas posteriores a 2017
  (desde la caché de TMDB); título en español cuando se conoce.
- galaxia.json: v=1 enciende las vistas.
- grafo.json: v de cada película; las vistas nuevas se enganchan a las personas que ya
  están en el grafo, y cada persona cuenta cuántas de sus películas has visto.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

CAMPOS_FICHA = ("t", "a", "g", "d", "dp", "c", "cp", "rt", "va", "nv", "p", "o")


class ErrorSincronizacion(Exception):
    """Falta información para que los archivos cuenten la misma historia."""


@dataclass
class Informe:
    fichas_nuevas: list[int] = field(default_factory=list)
    fichas_cambiadas: int = 0
    galaxia_cambiadas: int = 0
    grafo_nodos_nuevos: list[int] = field(default_factory=list)
    grafo_sin_personas: list[int] = field(default_factory=list)  # vistas que no cuelgan de nadie del grafo
    titulos_es: int = 0


def _ficha_desde_cache(entrada: dict[str, Any]) -> dict[str, Any]:
    faltan = [c for c in ("t", "a", "g", "c") if c not in entrada]
    if faltan:
        raise ErrorSincronizacion(f"Entrada de la caché de TMDB incompleta (faltan {faltan})")
    ficha = {c: entrada.get(c) for c in CAMPOS_FICHA}
    ficha["g"] = list(ficha["g"] or [])
    ficha["c"] = list(ficha["c"] or [])
    ficha["cp"] = list(ficha["cp"] or [None] * len(ficha["c"]))
    ficha["o"] = ficha["o"] or ""
    ficha["nv"] = int(ficha["nv"] or 0)
    return ficha


def sincronizar_fichas(fichas: dict[str, Any], vistas: set[int], cache_tmdb: dict[str, Any], titulos_es: dict[str, str], informe: Informe) -> dict[str, Any]:
    faltan = sorted(v for v in vistas if str(v) not in fichas and str(v) not in cache_tmdb)
    if faltan:
        raise ErrorSincronizacion(
            f"{len(faltan)} películas vistas no tienen ficha ni están en la caché de TMDB "
            f"(p. ej. {faltan[:5]}). Ejecuta antes: python -m atlas.tmdb"
        )
    salida: dict[str, Any] = {}
    for clave, f in fichas.items():
        nueva = {**f, "v": 1 if int(clave) in vistas else 0}
        if nueva["v"] != f.get("v"):
            informe.fichas_cambiadas += 1
        salida[clave] = nueva
    for v in sorted(vistas):
        if str(v) in salida:
            continue
        salida[str(v)] = {**_ficha_desde_cache(cache_tmdb[str(v)]), "v": 1, "reciente": 1}
        informe.fichas_nuevas.append(v)
    for clave, f in salida.items():
        te = titulos_es.get(clave)
        if te and te != f["t"]:
            f["te"] = te
            informe.titulos_es += 1
        else:
            f.pop("te", None)
    return salida


def sincronizar_galaxia(galaxia: list[dict[str, Any]], vistas: set[int], informe: Informe) -> list[dict[str, Any]]:
    salida = []
    for p in galaxia:
        v = 1 if p["id"] in vistas else 0
        if v != p["v"]:
            informe.galaxia_cambiadas += 1
        salida.append({**p, "v": v})
    return salida


def _desplazamiento(tmdb: int, radio: float = 12.0) -> tuple[float, float]:
    """Pequeño desplazamiento determinista para que un nodo nuevo no tape a su persona."""
    angulo = (tmdb * 2.399963) % (2 * math.pi)  # ángulo áureo: reparte sin colisiones regulares
    return radio * math.cos(angulo), radio * math.sin(angulo)


def sincronizar_grafo(grafo: dict[str, Any], fichas: dict[str, Any], vistas: set[int], informe: Informe) -> dict[str, Any]:
    nodos = [dict(n) for n in grafo["nodes"]]
    enlaces = [list(l) for l in grafo["links"]]
    peli_en = {n["id"]: i for i, n in enumerate(nodos) if n["t"] == "m"}
    persona_en: dict[str, int] = {}
    for i, n in enumerate(nodos):
        if n["t"] != "m":
            persona_en.setdefault(n["l"], i)

    for v in sorted(vistas):
        if v in peli_en:
            continue
        f = fichas.get(str(v))
        if not f:
            continue
        personas = [persona_en[p] for p in [f.get("d"), *f.get("c", [])] if p and p in persona_en]
        personas = list(dict.fromkeys(personas))  # sin repetir (quien dirige y actúa)
        if not personas:
            informe.grafo_sin_personas.append(v)
            continue
        dx, dy = _desplazamiento(v)
        x = sum(nodos[i]["x"] for i in personas) / len(personas) + dx
        y = sum(nodos[i]["y"] for i in personas) / len(personas) + dy
        nodos.append({"t": "m", "id": v, "l": f["t"], "a": f["a"], "v": 1, "p": f.get("p"), "x": round(x, 1), "y": round(y, 1)})
        nuevo = len(nodos) - 1
        peli_en[v] = nuevo
        enlaces.extend([nuevo, i] for i in personas)
        informe.grafo_nodos_nuevos.append(v)

    for n in nodos:
        if n["t"] == "m":
            n["v"] = 1 if n["id"] in vistas else 0
    vecinos: list[list[int]] = [[] for _ in nodos]
    for a, b in enlaces:
        vecinos[a].append(b)
        vecinos[b].append(a)
    for i, n in enumerate(nodos):
        if n["t"] != "m":
            n["v"] = sum(1 for j in vecinos[i] if nodos[j]["t"] == "m" and nodos[j]["v"] == 1)
    return {"nodes": nodos, "links": enlaces}
