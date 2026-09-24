// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ESQUEMAS, type NombreArchivo } from "../../src/lib/schema";
import { leer } from "./leer";

// Contrato: cada JSON publicado cumple su esquema. Si el pipeline cambia la forma
// de un archivo, este test falla en CI y no se publica nada.
const NOMBRES = Object.keys(ESQUEMAS) as NombreArchivo[];

describe("contrato de datos", () => {
  it.each(NOMBRES)("%s.json cumple su esquema", (nombre) => {
    const resultado = ESQUEMAS[nombre].safeParse(leer(nombre));
    // el mensaje de zod dice exactamente qué campo y en qué registro falla
    expect(resultado.success, resultado.success ? "" : resultado.error.message.slice(0, 2000)).toBe(true);
  });
});
