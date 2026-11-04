"""'Porque te gustó X': lo que TMDB recomienda a partir de tus favoritas.

Sin modelo: TMDB ya sabe qué películas se parecen a cada una de tus favoritas. Aquí solo
se decide cuáles son tus favoritas, se quita lo que ya viste o no se ha estrenado, y se
reparte sin repetir: cada película aparece una sola vez, bajo la favorita que va antes.
A diferencia de las candidatas del modelo, estas no están limitadas al dataset de 2017.
Sin pandas ni numpy: lo usa también el paso de red (atlas.tmdb).
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from typing import TYPE_CHECKING, Any

from . import config

if TYPE_CHECKING:
    from .trakt import ExportTrakt


def favoritas(notas: Mapping[int, int], ultima: Mapping[int, str | None], minima: int) -> list[int]:
    """Películas con nota >= minima: primero las de nota más alta; empate, la última que viste antes."""
    ids = [t for t, n in notas.items() if n >= minima]
    # dos pasadas estables: id ascendente, luego fecha descendente (sin fecha al final), luego nota descendente
    ids.sort()
    ids.sort(key=lambda t: ultima.get(t) or "", reverse=True)
    ids.sort(key=lambda t: notas[t], reverse=True)
    return ids


def recomendaciones_desde_api(d: dict[str, Any]) -> list[dict[str, Any]]:
    """Respuesta de /movie/{id}/recommendations -> lo mínimo para filtrar: id, estreno y votos."""
    return [{"id": int(r["id"]), "f": r.get("release_date") or "", "nv": int(r.get("vote_count") or 0)}
            for r in d.get("results") or []]


def elegir_recomendaciones(orden: Iterable[int], notas: Mapping[int, int], recs: Mapping[int, list[dict[str, Any]]],
                           vistas: set[int], calificadas: set[int], hoy: str, votos_min: int, maximo: int,
                           tiene_ficha: Callable[[int], bool] = lambda _: True) -> list[dict[str, Any]]:
    """Grupos {id de la favorita, n: su nota, recs: ids} en el orden de `orden`.

    Fuera: lo ya visto o calificado, la propia favorita, lo no estrenado a fecha `hoy`
    (o sin fecha), lo que tiene menos de `votos_min` votos y lo que no tiene ficha. Una
    favorita sin ficha no forma grupo.
    """
    usadas: set[int] = set()
    salida = []
    for origen in orden:
        if not tiene_ficha(origen):  # calificada sin estar en tu historial: la web no tendría cómo nombrarla
            continue
        elegidas = []
        for r in recs.get(origen, []):
            i = r["id"]
            if (i == origen or i in vistas or i in calificadas or i in usadas or not r["f"] or r["f"] > hoy
                    or r["nv"] < votos_min or not tiene_ficha(i)):
                continue
            elegidas.append(i)
            usadas.add(i)
            if len(elegidas) == maximo:
                break
        if elegidas:
            salida.append({"id": origen, "n": notas[origen], "recs": elegidas})
    return salida


def grupos_porque(export: ExportTrakt, recs: Mapping[int, list[dict[str, Any]]],
                  tiene_ficha: Callable[[int], bool] = lambda _: True) -> list[dict[str, Any]]:
    """Los grupos de 'porque te gustó X' para un export, con los parámetros de config.

    'Hoy' es el último día con un visionado fiable: así el resultado depende solo del
    export y de la caché, no del día en que se ejecuta.
    """
    hoy = max((v.ultima for v in export.vistas.values() if v.ultima), default="")
    orden = favoritas(export.notas, {t: v.ultima for t, v in export.vistas.items()}, config.NOTA_FAVORITA)
    return elegir_recomendaciones(orden, export.notas, recs, vistas=set(export.vistas), calificadas=set(export.notas),
                                  hoy=hoy, votos_min=config.VOTOS_MIN_CANDIDATA,
                                  maximo=config.RECOMENDACIONES_POR_FAVORITA, tiene_ficha=tiene_ficha)
