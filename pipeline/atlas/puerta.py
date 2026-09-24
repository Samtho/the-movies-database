"""Puerta de calidad: un refresco que empeora el modelo no se publica sin querer."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from . import config


@dataclass
class Veredicto:
    problemas: list[str] = field(default_factory=list)  # bloquean la publicación
    avisos: list[str] = field(default_factory=list)  # se informan, no bloquean

    @property
    def aprobado(self) -> bool:
        return not self.problemas


def revisar(previo: dict[str, Any] | None, nuevo: dict[str, Any]) -> Veredicto:
    v = Veredicto()
    if not nuevo.get("candidatos"):
        v.problemas.append("El modelo no produjo ninguna candidata")
    if previo is None:
        v.avisos.append("No hay refresco anterior con el que comparar")
        return v

    # los datos de julio guardaban este mismo AUC con el nombre auc_amplio
    auc_antes = (previo.get("auc_cv") or previo["auc_amplio"])[0]
    auc_ahora = nuevo["auc_cv"][0]
    if auc_antes - auc_ahora > config.CAIDA_MAX_AUC:
        v.problemas.append(f"El AUC cae de {auc_antes:.3f} a {auc_ahora:.3f} (máximo permitido: {config.CAIDA_MAX_AUC})")

    metodo_antes = previo.get("backtest", {}).get("metodo", 1)
    metodo_ahora = nuevo["backtest"].get("metodo", 1)
    if metodo_antes != metodo_ahora:
        v.avisos.append(f"El método del backtest cambió (v{metodo_antes} a v{metodo_ahora}): no se compara con el anterior")
    else:
        t_antes, t_ahora = previo["backtest"]["top10"], nuevo["backtest"]["top10"]
        if t_antes - t_ahora > config.CAIDA_MAX_TOP10:
            v.problemas.append(f"El backtest (top-10%) cae de {t_antes}% a {t_ahora}% (máximo permitido: {config.CAIDA_MAX_TOP10} puntos)")
    return v
