import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Datos, NombreArchivo } from "../../src/lib/schema";

// Lee un JSON real de public/data (los mismos que se publican).
export const DATA_DIR = join(import.meta.dirname, "../../public/data");

const cache = new Map<NombreArchivo, unknown>();
export function leer<N extends NombreArchivo>(nombre: N): Datos<N> {
  if (!cache.has(nombre)) cache.set(nombre, JSON.parse(readFileSync(join(DATA_DIR, `${nombre}.json`), "utf8")));
  return cache.get(nombre) as Datos<N>;
}
