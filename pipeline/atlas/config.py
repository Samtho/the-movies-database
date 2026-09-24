"""Parámetros del atlas. Todo lo que cambia el resultado está aquí, con su porqué."""

from __future__ import annotations

# ---------- modelo de gusto ----------
VOTOS_MIN_ENTRENO = 100  # universo "visible" con el que se entrena P(ver)
VOTOS_MIN_CANDIDATA = 30  # universo amplio de candidatas para recomendar
SEMILLA = 42  # SVD y validación cruzada: mismo input, mismo output
UMBRAL_SEGUNDA_ETAPA = 150  # notas válidas para entrenar P(gustar | ver)
NOTA_GUSTA = 7  # nota de Trakt (1-10) a partir de la cual cuenta como "me gustó"

# ---------- backtest temporal ----------
CORTE_BACKTEST = "2015-01-01"
# Votos y popularidad del dataset están medidos en 2017: con un corte en 2015 filtran
# información del futuro. El backtest conservador (el titular) los excluye; el techo
# los incluye. La verdad está entre ambos (issue 19).
VARIABLES_CON_FUTURO = ("vote_avg", "log_votes", "log_pop")
# 1: julio 2026 (última fecha, con fuga). 2: primera fecha + conservador/techo.
# 3: fuera del backtest lo visto sin fecha fiable (fecha desconocida o carga en bloque, issues 20 y 21).
VERSION_METODO = 3

# ---------- puerta de calidad ----------
CAIDA_MAX_AUC = 0.02  # si el AUC cae más que esto frente al refresco anterior, no se publica
CAIDA_MAX_TOP10 = 10  # puntos porcentuales del backtest conservador

# ---------- historial ----------
# Zonas horarias por etapas, para el mapa día × hora (issue 17). Cada tramo rige desde
# su fecha (inclusive) hasta el siguiente. Antes del primer tramo, ZONA_INICIAL.
ZONA_INICIAL = "America/Caracas"
ZONAS_POR_ETAPA: tuple[tuple[str, str], ...] = (("2025-08-01", "Europe/Madrid"),)
# Una misma hora exacta que concentra más de esta fracción del historial es relleno
# de importación (visionados registrados solo con fecha), no una hora real.
FRACCION_HORA_RELLENO = 0.2
# Carga en bloque (issue 21): CARGA_EN_BLOQUE_MIN o más visionados dentro de una ventana
# de CARGA_EN_BLOQUE_HORAS. Nadie ve 10 películas en 12 horas: es el día en que se
# registró de golpe un historial antiguo, y su fecha es la del registro, no la del visionado.
CARGA_EN_BLOQUE_MIN = 10
CARGA_EN_BLOQUE_HORAS = 12
