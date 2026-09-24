# CLAUDE.md

Contexto permanente de The Movies Database. Léelo antes de tocar código.

## Qué es

Atlas personal de cine de Samuel Ortega: historial de Trakt × The Movies Dataset (Kaggle,
hasta 2017) × API de TMDB, con un recomendador de regresión logística entrenado con su
gusto. Sitio estático en GitHub Pages, embebido en su portfolio (samtho.github.io).

## Estructura

- `src/`: app React. `src/caps/` tiene una vista por capítulo; `src/lib/` la lógica y utilidades.
- `public/data/`: los 8 JSON que consume la app. Los genera el pipeline, no se editan a mano.
- `pipeline/`: Python. Regenera los JSON a partir del export de Trakt.
- `tests/e2e/`: Playwright contra el build real. `tests/data/`: tests sobre los JSON reales.

## Comandos

- `npm run check`: la misma puerta que el CI (lint, tipos, tests, build, e2e). Debe pasar antes de cualquier push.
- `npm run dev`: servidor local.

## Reglas

- Comentarios y documentación en español neutro; identificadores en inglés o español
  según el archivo existente, sin mezclar dentro de un mismo módulo.
- Sin guion largo (em dash) en ningún texto: código, comentarios ni UI.
- TypeScript en `strict`. Lint sin avisos (`--max-warnings 0`).
- Todo cambio de lógica lleva test, con casos borde. La lógica vive en funciones puras testeables, no dentro de los componentes.
- Ningún número del historial o del modelo se escribe a mano en la UI: sale de los datos.
- Secretos y datos personales crudos fuera de git: clave de TMDB en `.env`, export de Trakt y CSV en `pipeline/raw/` (ignorado).
- El universo de películas (dataset de Kaggle) está congelado en 2017. Galaxia, similares e industria no cambian al refrescar; lo que cambia es el historial.
