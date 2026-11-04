"""Parámetros del atlas. Todo lo que cambia el resultado está aquí, con su porqué."""

from __future__ import annotations

# ---------- modelo de gusto ----------
VOTOS_MIN_ENTRENO = 100  # universo "visible" con el que se entrena P(ver)
VOTOS_MIN_CANDIDATA = 30  # universo amplio de candidatas para recomendar
SEMILLA = 42  # SVD y validación cruzada: mismo input, mismo output
UMBRAL_SEGUNDA_ETAPA = 150  # notas válidas para entrenar P(gustar | ver)
NOTA_GUSTA = 7  # nota de Trakt (1-10) a partir de la cual cuenta como "me gustó"

# ---------- tus notas en el ranking (atlas/notas.py) ----------
# El 7 es tu nota más frecuente: "bien", ni suma ni resta. Cada nota pesa nota - NOTA_NEUTRA.
NOTA_NEUTRA = 7
# Cuánto mueve la afinidad el ranking: logit(P(ver)) + PESO_NOTAS × afinidad estandarizada.
# Con 1, una candidata una desviación más afín a tus notas gana lo mismo que multiplicar por e
# sus probabilidades de verla. Es un peso moderado: el modelo de lo que ves sigue mandando.
PESO_NOTAS = 1.0
NOTAS_MIN_AFINIDAD = 20  # con menos notas la validación es ruido y la afinidad no se aplica
UMBRAL_PARECIDA = 1.0  # afinidad estandarizada desde la que se explica "parecida a X"
# Calidad: tus notas siguen a la nota media de TMDB (rho 0,57 en noviembre de 2026). Si esa
# señal supera al azar, el orden suma logit(P(ver)) + PESO_CALIDAD × nota ponderada estandarizada.
# Mismo peso moderado que el de tus notas: 0 la apaga.
PESO_CALIDAD = 1.0
VOTOS_PRIOR_CALIDAD = 100  # una nota con 100 votos queda a medio camino de la media (nota_ponderada)
NOTA_BIEN_VALORADA = 7.5  # nota ponderada de TMDB desde la que se explica "muy bien valorada"

# ---------- "porque te gustó X" (atlas/recomendaciones.py) ----------
NOTA_FAVORITA = 8  # 8, 9 y 10: favoritas (el 7 es tu nota habitual, no "me encantó")
RECOMENDACIONES_POR_FAVORITA = 12

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
