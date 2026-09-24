#!/usr/bin/env bash
# Refresca los datos del atlas con tu export más reciente de Trakt, en un solo comando.
#
#   bash ~/Desktop/Side\ Projects/the-movies-database/pipeline/refrescar.sh
#
# Qué hace:
#   1. Busca el export de Trakt más reciente (trakt-export*, zip o carpeta) en
#      pipeline/raw/ y en Descargas, y lo copia a pipeline/raw/ si hace falta.
#   2. Prepara Python la primera vez (entorno en pipeline/.venv).
#   3. Pide a TMDB lo que falta (fichas nuevas y títulos en español).
#   4. Actualiza los datos de la web (public/data), con la puerta de calidad.
# No sube nada a GitHub: eso se hace después de revisar los cambios.
# Compatible con el bash 3.2 que trae macOS.

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw

paso() { printf '\n\033[1;33m%s\033[0m\n' "$1"; }
fallo() { printf '\n\033[1;31m%s\033[0m\n' "$1" >&2; exit 1; }

# ---------- 1. el export ----------
paso "1/4 · Buscando tu export de Trakt"
# el más reciente de los dos sitios (ls -t ordena todos juntos; admite espacios en el nombre)
export_trakt="$(ls -td raw/trakt-export* "$HOME"/Downloads/trakt-export* 2>/dev/null | head -n 1 || true)"
[ -n "$export_trakt" ] || fallo "No encuentro ningún trakt-export (zip o carpeta) ni en pipeline/raw ni en Descargas. Descárgalo de Trakt y vuelve a lanzar este comando."
case "$export_trakt" in
  raw/*) ;;
  *)
    destino="raw/$(basename "$export_trakt")"
    rm -rf "$destino"
    cp -R "$export_trakt" "$destino"
    export_trakt="$destino"
    ;;
esac
echo "Usando: $export_trakt"

# ---------- 2. Python ----------
paso "2/4 · Preparando Python"
python=""
for p in python3.13 python3.12 python3.11 python3; do
  if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
    python="$p"
    break
  fi
done
[ -n "$python" ] || fallo "Hace falta Python 3.11 o superior. Instálalo con: brew install python@3.12  (y vuelve a lanzar este comando)"
if [ ! -x .venv/bin/python ]; then
  echo "Primera vez: creando el entorno con $("$python" --version)…"
  "$python" -m venv .venv
fi
if ! cmp -s requirements.txt .venv/.requirements-instalados 2>/dev/null; then
  echo "Instalando dependencias (solo la primera vez o si cambian)…"
  .venv/bin/python -m pip install --quiet --upgrade pip
  .venv/bin/python -m pip install --quiet -r requirements.txt
  cp requirements.txt .venv/.requirements-instalados
fi
[ -f .env ] || fallo "Falta pipeline/.env con tu clave de TMDB (una línea: TMDB_API_KEY=tu_clave)."

# ---------- 3. TMDB ----------
paso "3/4 · Pidiendo a TMDB lo que falta (la primera vez tarda unos minutos)"
.venv/bin/python -m atlas.tmdb --trakt "$export_trakt" --raw raw --data ../public/data \
  || fallo "Falló el paso de TMDB. Si fue un corte de red, vuelve a lanzar el comando: sigue donde iba."

# ---------- 4. actualizar ----------
paso "4/4 · Actualizando los datos de la web"
.venv/bin/python -m atlas.actualizar --trakt "$export_trakt" --raw raw --data ../public/data \
  || fallo "La actualización se detuvo (arriba está el motivo). No se escribió nada."

paso "Listo. Vuelve a Claude y escribe: listo"
