"""Lectura y escritura de JSON. Escribir es atómico: nunca queda un archivo a medias."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def leer_json(ruta: Path) -> Any:
    return json.loads(Path(ruta).read_text(encoding="utf-8"))


def escribir_json(ruta: Path, contenido: Any) -> None:
    """Escribe en un temporal de la misma carpeta y lo renombra encima del destino."""
    ruta = Path(ruta)
    fd, temporal = tempfile.mkstemp(dir=ruta.parent, prefix=f".{ruta.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(contenido, f)
        os.replace(temporal, ruta)
    except BaseException:
        Path(temporal).unlink(missing_ok=True)
        raise
