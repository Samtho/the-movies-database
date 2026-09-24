# Pipeline del atlas

Genera los JSON de `public/data/` a partir de tu export de Trakt. El universo de
películas (The Movies Dataset de Kaggle, hasta 2017) está congelado: la galaxia, las
similares y la industria no se recalculan. Lo que cambia en cada refresco es tu historial.

## Preparación (una vez)

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

En `pipeline/raw/` (fuera de git) tienen que estar:

- `md_full.pkl`: el dataset limpio de Kaggle (adjunto en la release `datos-2017` del repo).
- `tmdb_cache.json` y `titulos_es.json`: cachés de TMDB (se crean y completan solas).
- El export de Trakt: el `.zip` tal cual se descarga.

Y en `pipeline/.env` (fuera de git): `TMDB_API_KEY=tu_clave`.

## Refrescar los datos

Lo más cómodo: descarga el export de Trakt (se queda en Descargas) y ejecuta

```bash
bash ~/Desktop/Side\ Projects/the-movies-database/pipeline/refrescar.sh
```

El script encuentra el export más reciente, prepara Python la primera vez y ejecuta los
dos pasos de abajo. Paso a paso, a mano:

```bash
cd pipeline
python -m atlas.tmdb       --trakt raw/<export>.zip --raw raw --data ../public/data   # necesita red
python -m atlas.actualizar --trakt raw/<export>.zip --raw raw --data ../public/data
cd .. && npm run check && git add public/data && git commit -m "Datos: refresco <mes>" && git push
```

`atlas.tmdb` pide a la API solo lo que falta (fichas de lo que viste después de 2017 y
títulos en español). Si se corta, vuelve a lanzarlo: sigue donde iba.

`atlas.actualizar` no escribe nada si algo falla, y tiene una puerta de calidad: si el
AUC cae más de 0,02 o el backtest más de 10 puntos frente al refresco anterior, se
detiene y explica por qué (`--forzar` para publicar igualmente si el cambio es esperado).

## Qué calcula y cómo

| Paso | Módulo | Notas |
|---|---|---|
| Leer el export | `atlas/trakt.py` | Primera y última vez que viste cada película, notas, historial con hora. Fechas no fiables: la "fecha desconocida" de Trakt (1970-01-01) y las cargas en bloque (10 o más visionados en 12 horas). Esas películas cuentan como vistas, pero sin fecha |
| Modelo de gusto | `atlas/modelo.py` | Regresión logística, AUC en validación cruzada 5-fold sobre películas con 100 votos o más |
| Backtest | `atlas/backtest.py` | Corte en 2015 con la PRIMERA fecha de visionado. Conservador (sin votos ni popularidad, medidos en 2017) y techo (con ellos). Lo visto sin fecha fiable queda fuera |
| Estadísticas | `atlas/estadisticas.py` | Línea temporal y mapa día × hora solo con fechas fiables; horas de relleno fuera del mapa; hora local por etapas (`config.py`) |
| Sincronizar | `atlas/sincronizar.py` | "Visto" en fichas, galaxia y grafo; fichas nuevas desde la caché de TMDB |
| Derivados web | `atlas/derivar_front.py` | Muro de portada, pósters de repetidas, resumen, similares sin autorreferencias |
| Puerta | `atlas/puerta.py` | Bloquea un refresco que empeora el modelo |

Todos los parámetros (umbrales, corte, zonas horarias) están en `atlas/config.py`.

## Tests

`python -m pytest -q` (desde `pipeline/`). Usan datos sintéticos: nunca tus datos reales.
