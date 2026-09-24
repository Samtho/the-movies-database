"""Paso con red: completa desde la API de TMDB lo que el atlas no tiene.

- Fichas de las películas vistas que no están en el dataset (posteriores a 2017).
- Títulos en español de todas las fichas (la búsqueda de la web usa los dos).

Necesita la clave en la variable TMDB_API_KEY o en pipeline/.env (TMDB_API_KEY=...).
Ese archivo está fuera de git. La clave nunca se imprime.

Uso (desde pipeline/):  python -m atlas.tmdb --trakt raw/<export>.zip --raw raw --data ../public/data
Lo ya descargado queda en caché (raw/tmdb_cache.json, raw/titulos_es.json): si se corta,
se vuelve a lanzar y sigue donde iba.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Any

from .archivos import escribir_json, leer_json
from .trakt import cargar_export

API = "https://api.themoviedb.org/3"
PAUSA = 0.03  # ~30 peticiones por segundo, por debajo del límite de TMDB
GUARDAR_CADA = 200

Pedidor = Callable[[str, dict[str, str]], dict[str, Any]]


class ErrorTMDB(Exception):
    """Fallo de la API de TMDB (con el id afectado cuando se conoce)."""


def clave_api(env_path: Path = Path(".env")) -> str:
    clave = os.environ.get("TMDB_API_KEY", "").strip()
    if not clave and env_path.exists():
        for linea in env_path.read_text(encoding="utf-8").splitlines():
            nombre, _, valor = linea.partition("=")
            if nombre.strip() == "TMDB_API_KEY":
                clave = valor.strip().strip('"').strip("'")
    if not clave:
        raise ErrorTMDB("Falta la clave de TMDB: define TMDB_API_KEY o créala en pipeline/.env")
    return clave


def crear_pedidor(clave: str, intentos: int = 4, espera: float = 1.0,
                  abrir: Callable[..., Any] = urllib.request.urlopen, dormir: Callable[[float], None] = time.sleep) -> Pedidor:
    """GET a la API con reintentos (red, 429 y 5xx, con espera creciente). Un 404 no se reintenta."""
    def pedir(ruta: str, parametros: dict[str, str]) -> dict[str, Any]:
        url = f"{API}{ruta}?{urllib.parse.urlencode({**parametros, 'api_key': clave})}"
        ultimo: Exception | None = None
        for intento in range(intentos):
            try:
                with abrir(url, timeout=15) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    raise ErrorTMDB(f"{ruta}: no existe en TMDB (404)") from None
                if e.code not in (429, 500, 502, 503, 504):
                    raise ErrorTMDB(f"{ruta}: HTTP {e.code}") from None
                ultimo = e
            except (urllib.error.URLError, TimeoutError) as e:
                ultimo = e
            dormir(espera * (2 ** intento))
        # sin la URL en el mensaje: lleva la clave
        raise ErrorTMDB(f"{ruta}: sin respuesta tras {intentos} intentos ({type(ultimo).__name__})")
    return pedir


def ficha_desde_api(d: dict[str, Any]) -> dict[str, Any]:
    """Respuesta de /movie/{id}?append_to_response=credits -> formato de caché/ficha."""
    creditos = d.get("credits") or {}
    direccion = next((c for c in creditos.get("crew", []) if c.get("job") == "Director"), None)
    reparto = (creditos.get("cast") or [])[:3]
    fecha = d.get("release_date") or ""
    return {
        "t": d.get("original_title") or d.get("title") or "",
        "a": int(fecha[:4]) if fecha[:4].isdigit() else 0,
        "g": [g["name"] for g in d.get("genres", [])][:3],
        "rt": d.get("runtime") or None,
        "va": round(float(d.get("vote_average") or 0), 1),
        "nv": int(d.get("vote_count") or 0),
        "p": d.get("poster_path"),
        "o": (d.get("overview") or "")[:220],
        "d": direccion.get("name") if direccion else None,
        "dp": direccion.get("profile_path") if direccion else None,
        "c": [c["name"] for c in reparto],
        "cp": [c.get("profile_path") for c in reparto],
    }


def completar(ids: Iterable[int], cache: dict[str, Any], pedir: Pedidor, ruta: Callable[[int], str],
              parametros: dict[str, str], transformar: Callable[[dict[str, Any]], Any],
              guardar: Callable[[], None] = lambda: None, pausa: float = PAUSA) -> list[tuple[int, str]]:
    """Pide a TMDB solo los ids que faltan en la caché. Devuelve los fallidos (id, motivo)."""
    fallidos: list[tuple[int, str]] = []
    pendientes = [i for i in ids if str(i) not in cache]
    for n, tmdb in enumerate(pendientes, 1):
        try:
            cache[str(tmdb)] = transformar(pedir(ruta(tmdb), parametros))
        except ErrorTMDB as e:
            fallidos.append((tmdb, str(e)))
        if n % GUARDAR_CADA == 0:
            guardar()
        time.sleep(pausa)
    guardar()
    return fallidos


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Completa fichas y títulos en español desde TMDB")
    p.add_argument("--trakt", required=True, type=Path, help="export de Trakt (.zip o carpeta)")
    p.add_argument("--raw", required=True, type=Path, help="carpeta con md_full.pkl y las cachés")
    p.add_argument("--data", required=True, type=Path, help="carpeta public/data")
    p.add_argument("--sin-titulos", action="store_true", help="no pedir títulos en español")
    a = p.parse_args(argv)

    pedir = crear_pedidor(clave_api())
    fichas = leer_json(a.data / "fichas.json")
    export = cargar_export(a.trakt)

    ruta_cache = a.raw / "tmdb_cache.json"
    cache = leer_json(ruta_cache) if ruta_cache.exists() else {}
    import pickle  # solo aquí: el resto del paso no necesita pandas
    en_dataset = set(pickle.load(open(a.raw / "md_full.pkl", "rb")).tmdb)
    nuevas = sorted(t for t in export.vistas if t not in en_dataset and str(t) not in fichas)
    print(f"Fichas: {len(nuevas)} vistas fuera del dataset; {sum(1 for t in nuevas if str(t) not in cache)} por pedir")
    fallidos = completar(nuevas, cache, pedir, lambda t: f"/movie/{t}", {"append_to_response": "credits"},
                         ficha_desde_api, guardar=lambda: escribir_json(ruta_cache, cache))

    if not a.sin_titulos:
        ruta_titulos = a.raw / "titulos_es.json"
        titulos = leer_json(ruta_titulos) if ruta_titulos.exists() else {}
        todas = sorted({int(k) for k in fichas} | set(nuevas))
        print(f"Títulos en español: {sum(1 for t in todas if str(t) not in titulos)} por pedir (de {len(todas)})")
        fallidos += completar(todas, titulos, pedir, lambda t: f"/movie/{t}", {"language": "es-ES"},
                              lambda d: d.get("title") or "", guardar=lambda: escribir_json(ruta_titulos, titulos))

    if fallidos:
        print(f"\n{len(fallidos)} peticiones fallaron (vuelve a lanzar el comando para reintentarlas):", file=sys.stderr)
        for tmdb, motivo in fallidos[:20]:
            print(f"  {tmdb}: {motivo}", file=sys.stderr)
        return 1
    print("TMDB al día.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
