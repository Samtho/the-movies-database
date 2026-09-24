# The Movies Database

Atlas personal de cine: el historial completo de Trakt de Samuel Ortega cruzado con
[The Movies Dataset](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset)
(TMDB + MovieLens, hasta 2017), con un recomendador entrenado con su propio gusto.

En vivo: https://samtho.github.io/the-movies-database/

## Vistas

| Vista | Qué muestra |
|---|---|
| Inicio | Marquesina con los números del historial |
| Tu vida en cine | Visionados por mes, día × hora, décadas, repetidas, directores, actores y géneros |
| La galaxia | 45.000 películas proyectadas por similitud de contenido; las vistas, encendidas |
| El grafo | Grafo local de películas y personas, y grados de separación entre dos nombres |
| Esta noche | Candidatas no vistas ordenadas por el modelo de gusto, con filtros y sorpresa |
| Tu gusto (ML) | Torneo de modelos, coeficientes del ganador y backtest temporal |
| La industria | EDA del dataset: producción por año, nota por género, presupuesto contra taquilla |

## Stack

- React 19, TypeScript en modo strict, Vite 8, Tailwind v4
- ECharts (gráficos), deck.gl (galaxia), Canvas 2D (grafo), motion (animación)
- Vitest + Testing Library (unitarios y componentes), Playwright (e2e)
- Sitio estático: todos los datos son JSON precalculados en `public/data/`
- Despliegue: GitHub Pages vía GitHub Actions

## Desarrollo

```bash
npm ci
npm run dev          # servidor local
npm run check        # lint + tipos + tests + build + e2e (lo mismo que el CI)
```

Scripts sueltos: `lint`, `typecheck`, `test`, `test:watch`, `test:cov`, `build`, `test:e2e`.

Para los e2e hace falta Chromium de Playwright (`npx playwright install chromium`).

## Datos

La app no tiene backend. Lee 8 JSON de `public/data/` generados por el pipeline de Python
en `pipeline/` (cómo refrescarlos: [`pipeline/README.md`](pipeline/README.md)). Los datos
crudos (dataset de Kaggle, export de Trakt), los intermedios (`*.pkl`) y la clave de TMDB
**nunca** entran en git (ver `.gitignore`).

El contrato de los JSON está en `src/lib/schema.ts` y se valida en CI junto con 16
invariantes entre archivos (`tests/data/`).

## Despliegue

Un push a `main` ejecuta el workflow `CI y despliegue`: si lint, tipos, tests, build y e2e
pasan, publica `dist/` en GitHub Pages. Si algo falla, no se publica nada.

## Atribución

Imágenes y datos de películas: [TMDB](https://www.themoviedb.org/). Este producto usa la
API de TMDB sin estar respaldado ni certificado por TMDB.
