"""Derivados que la web necesita y que no conviene calcular en el navegador.

Se ejecuta después de generar los 8 JSON y es idempotente:

    cd pipeline && python3 -m atlas.derivar_front ../public/data  (también lo llama atlas.actualizar)

- similares.json: quita las autorreferencias (una película nunca es "similar" de sí misma).
- stats.json:
  - rewatch[].p: póster de cada película repetida (así "Tu vida en cine" no descarga fichas.json).
  - muro: pósters de la portada (repetidas y luego puntuadas, sin duplicados).
  - resumen: cifras del universo y del modelo que se muestran fuera de sus vistas
    (portada, pie, industria), para no escribirlas a mano en la UI.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

MURO_MAX = 28


def sanear_similares(similares: dict[str, list[int]]) -> dict[str, list[int]]:
    """Quita la propia película y los duplicados de cada lista, conservando el orden."""
    limpio: dict[str, list[int]] = {}
    for clave, lista in similares.items():
        propio = int(clave)
        vistos: set[int] = set()
        salida: list[int] = []
        for otro in lista:
            if otro == propio or otro in vistos:
                continue
            vistos.add(otro)
            salida.append(otro)
        limpio[clave] = salida
    return limpio


def poster_de(fichas: dict[str, Any], tmdb_id: int | None) -> str | None:
    if tmdb_id is None:
        return None
    ficha = fichas.get(str(tmdb_id))
    return ficha.get("p") if ficha else None


def con_posters_rewatch(rewatch: list[dict[str, Any]], fichas: dict[str, Any]) -> list[dict[str, Any]]:
    return [{**r, "p": poster_de(fichas, r.get("id"))} for r in rewatch]


def muro_portada(stats: dict[str, Any], fichas: dict[str, Any], maximo: int = MURO_MAX) -> list[dict[str, Any]]:
    """Pósters de la portada: primero las repetidas, luego las puntuadas; sin duplicados ni huecos."""
    muro: list[dict[str, Any]] = []
    usados: set[int] = set()
    for item in [*stats.get("rewatch", []), *stats.get("ratings", [])]:
        tmdb_id = item.get("id")
        if tmdb_id is None or tmdb_id in usados:
            continue
        p = poster_de(fichas, tmdb_id)
        if not p:
            continue
        usados.add(tmdb_id)
        muro.append({"id": tmdb_id, "p": p})
        if len(muro) == maximo:
            break
    return muro


def resumen(galaxia: list[dict[str, Any]], gusto: dict[str, Any]) -> dict[str, Any]:
    auc, auc_std = gusto["auc_cv"]
    return {
        "universo": len(galaxia),
        "auc": round(float(auc), 3),
        "auc_std": round(float(auc_std), 3),
        "modelos": len(gusto["benchmark"]),
    }


def aplicar_derivados(datos: dict[str, Any]) -> None:
    """Aplica los derivados sobre los JSON en memoria (claves: fichas, stats, similares, galaxia, gusto)."""
    fichas = datos["fichas"]
    stats = datos["stats"]
    datos["similares"] = sanear_similares(datos["similares"])
    stats["rewatch"] = con_posters_rewatch(stats["rewatch"], fichas)
    stats["muro"] = muro_portada(stats, fichas)
    stats["resumen"] = resumen(datos["galaxia"], datos["gusto"])


def derivar(data_dir: Path) -> None:
    nombres = ("fichas", "stats", "similares", "galaxia", "gusto")
    datos = {n: json.loads((data_dir / f"{n}.json").read_text(encoding="utf-8")) for n in nombres}
    aplicar_derivados(datos)
    for n in ("similares", "stats"):
        (data_dir / f"{n}.json").write_text(json.dumps(datos[n]), encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: python3 -m atlas.derivar_front <carpeta con los JSON>")
    derivar(Path(sys.argv[1]))
