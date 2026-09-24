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
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from .archivos import escribir_json, leer_json
from .trakt import ErrorExport, cargar_export

API = "https://api.themoviedb.org/3"
HILOS = 6  # peticiones en paralelo: ~40 por segundo, por debajo del límite de TMDB (~50)
GUARDAR_CADA = 500
ABORTAR_TRAS = 12  # si estas primeras peticiones fallan todas, se para (sin red o clave inválida)

Pedidor = Callable[[str, dict[str, str]], dict[str, Any]]


class ErrorTMDB(Exception):
    """Fallo de la API de TMDB (con el id afectado cuando se conoce)."""


class NoExisteEnTMDB(ErrorTMDB):
    """La API respondió, pero esa película ya no existe (404)."""


def ficha_minima(titulo: str, anio: int | None) -> dict[str, Any]:
    """Ficha con lo poco que se sabe por Trakt, para una película que TMDB ya no tiene."""
    return {"t": titulo, "a": anio or 0, "g": [], "rt": None, "va": None, "nv": 0, "p": None, "o": "",
            "d": None, "dp": None, "c": [], "cp": []}


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
                    raise NoExisteEnTMDB(f"{ruta}: no existe en TMDB (404)") from None
                if e.code == 401:
                    raise ErrorTMDB(f"{ruta}: HTTP 401, la clave de TMDB no es válida") from None
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
              guardar: Callable[[], None] = lambda: None, hilos: int = HILOS, etiqueta: str = "",
              si_no_existe: Callable[[int], Any] | None = None) -> list[tuple[int, str]]:
    """Pide a TMDB solo los ids que faltan en la caché, con varias peticiones en paralelo.

    La caché solo se toca desde este hilo (los hilos solo piden) y se guarda cada
    GUARDAR_CADA respuestas: si el proceso se corta, lo ya descargado no se pierde.
    Si TMDB responde que una película no existe (404) y hay `si_no_existe`, se guarda
    ese valor en la caché (no se vuelve a pedir); si no, cuenta como fallo.
    Devuelve los fallidos (id, motivo), ordenados por id.
    """
    fallidos: list[tuple[int, str]] = []
    pendientes = [i for i in ids if str(i) not in cache]

    # Parada temprana: si las primeras ABORTAR_TRAS peticiones fallan todas (sin red o
    # clave inválida), se para en vez de agotar reintentos con miles de películas. Lo
    # deciden los propios hilos, para que no sigan pidiendo mientras este hilo se pone al día.
    parar = threading.Event()
    candado = threading.Lock()
    conteo = {"respuestas": 0, "fallos": 0, "primer_fallo": ""}

    def una(tmdb: int) -> Any:
        if parar.is_set():
            raise ErrorTMDB("cancelada")
        try:
            resultado = transformar(pedir(ruta(tmdb), parametros))
        except NoExisteEnTMDB:
            with candado:
                conteo["respuestas"] += 1  # la API respondió: la red y la clave funcionan
            raise
        except ErrorTMDB as e:
            with candado:
                conteo["fallos"] += 1
                conteo["primer_fallo"] = conteo["primer_fallo"] or str(e)
                if conteo["respuestas"] == 0 and conteo["fallos"] >= ABORTAR_TRAS:
                    parar.set()
            raise
        with candado:
            conteo["respuestas"] += 1
        return resultado
    with ThreadPoolExecutor(max_workers=max(1, hilos)) as pool:
        futuros = {pool.submit(una, t): t for t in pendientes}
        for n, futuro in enumerate(as_completed(futuros), 1):
            tmdb = futuros[futuro]
            try:
                cache[str(tmdb)] = futuro.result()
            except NoExisteEnTMDB as e:
                if si_no_existe is None:
                    fallidos.append((tmdb, str(e)))
                else:
                    cache[str(tmdb)] = si_no_existe(tmdb)
            except ErrorTMDB as e:
                fallidos.append((tmdb, str(e)))
            if parar.is_set():
                pool.shutdown(wait=False, cancel_futures=True)
                guardar()
                raise ErrorTMDB(f"Las primeras {ABORTAR_TRAS} peticiones a TMDB fallaron ({conteo['primer_fallo']}). "
                                "Revisa la conexión a internet y la clave en pipeline/.env.")
            if n % GUARDAR_CADA == 0:
                guardar()
                if etiqueta:
                    print(f"  {etiqueta}: {n} de {len(pendientes)}", flush=True)
    guardar()
    return sorted(fallidos)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Completa fichas y títulos en español desde TMDB")
    p.add_argument("--trakt", required=True, type=Path, help="export de Trakt (.zip o carpeta)")
    p.add_argument("--raw", required=True, type=Path, help="carpeta con md_full.pkl y las cachés")
    p.add_argument("--data", required=True, type=Path, help="carpeta public/data")
    p.add_argument("--sin-titulos", action="store_true", help="no pedir títulos en español")
    a = p.parse_args(argv)
    try:
        return _completar_todo(a)
    except (ErrorTMDB, ErrorExport) as e:
        print(f"\n{e}", file=sys.stderr)
        return 1


def _completar_todo(a: argparse.Namespace) -> int:
    pedir = crear_pedidor(clave_api())
    fichas = leer_json(a.data / "fichas.json")
    export = cargar_export(a.trakt)

    ruta_cache = a.raw / "tmdb_cache.json"
    cache = leer_json(ruta_cache) if ruta_cache.exists() else {}
    import pickle  # solo aquí: el resto del paso no necesita pandas
    en_dataset = set(pickle.load(open(a.raw / "md_full.pkl", "rb")).tmdb)
    nuevas = sorted(t for t in export.vistas if t not in en_dataset and str(t) not in fichas)
    print(f"Fichas: {len(nuevas)} vistas fuera del dataset; {sum(1 for t in nuevas if str(t) not in cache)} por pedir")
    # si TMDB ya no tiene la película (404), ficha mínima con lo que dice Trakt
    fallidos = completar(nuevas, cache, pedir, lambda t: f"/movie/{t}", {"append_to_response": "credits"},
                         ficha_desde_api, guardar=lambda: escribir_json(ruta_cache, cache), etiqueta="fichas",
                         si_no_existe=lambda t: ficha_minima(export.vistas[t].titulo, export.vistas[t].anio))
    if fallidos:
        print(f"\n{len(fallidos)} fichas no se pudieron descargar (vuelve a lanzar el comando para reintentarlas):", file=sys.stderr)
        for tmdb, motivo in fallidos[:20]:
            print(f"  {tmdb}: {motivo}", file=sys.stderr)
        return 1

    if not a.sin_titulos:
        ruta_titulos = a.raw / "titulos_es.json"
        titulos = leer_json(ruta_titulos) if ruta_titulos.exists() else {}
        todas = sorted({int(k) for k in fichas} | set(nuevas))
        print(f"Títulos en español: {sum(1 for t in todas if str(t) not in titulos)} por pedir (de {len(todas)})")
        sin_titulo = completar(todas, titulos, pedir, lambda t: f"/movie/{t}", {"language": "es-ES"},
                               lambda d: d.get("title") or "", guardar=lambda: escribir_json(ruta_titulos, titulos),
                               etiqueta="títulos", si_no_existe=lambda t: "")
        # los títulos son un extra de la búsqueda: si faltan algunos, no se bloquea el refresco
        if sin_titulo:
            print(f"Aviso: {len(sin_titulo)} títulos en español quedaron pendientes; se pedirán en el próximo refresco.")
    print("TMDB al día.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
