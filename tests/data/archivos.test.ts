// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Humo de datos: los 8 JSON que consume la app existen y son JSON válido.
// El contrato completo (esquemas Zod e invariantes entre archivos) llega en la Fase 1.
const DATA = join(import.meta.dirname, "../../public/data");
const ARCHIVOS = ["fichas", "galaxia", "grafo", "gusto", "industria", "similares", "stats", "vistas"] as const;

describe("public/data", () => {
  it.each(ARCHIVOS)("%s.json existe y parsea", (nombre) => {
    const crudo = readFileSync(join(DATA, `${nombre}.json`), "utf8");
    expect(() => JSON.parse(crudo)).not.toThrow();
  });
});
