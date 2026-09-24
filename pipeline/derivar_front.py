"""Derivados que la web necesita y que no conviene calcular en el navegador.

Se ejecuta después de generar los 8 JSON y es idempotente:

    python3 pipeline/derivar_front.py public/data

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
    auc, auc_std = gusto["auc_amplio"]
    return {
        "universo": len(galaxia),
        "auc": round(float(auc), 3),
        "auc_std": round(float(auc_std), 3),
        "modelos": len(gusto["benchmark"]),
    }


def derivar(data_dir: Path) -> None:
    def leer(nombre: str) -> Any:
        return json.loads((data_dir / f"{nombre}.json").read_text(encoding="utf-8"))

    def escribir(nombre: str, contenido: Any) -> None:
        (data_dir / f"{nombre}.json").write_text(json.dumps(contenido), encoding="utf-8")

    fichas = leer("fichas")
    stats = leer("stats")

    escribir("similares", sanear_similares(leer("similares")))

    stats["rewatch"] = con_posters_rewatch(stats["rewatch"], fichas)
    stats["muro"] = muro_portada(stats, fichas)
    stats["resumen"] = resumen(leer("galaxia"), leer("gusto"))
    escribir("stats", stats)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: python3 pipeline/derivar_front.py <carpeta con los JSON>")
    derivar(Path(sys.argv[1]))
