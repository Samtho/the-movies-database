import { describe, expect, it } from "vitest";
import { colorGenero, COLOR_GENERO_DESCONOCIDO, GENEROS_FILTRABLES, generoEs } from "./generos";

describe("géneros", () => {
  it("traduce los conocidos y deja tal cual los desconocidos", () => {
    expect(generoEs("Science Fiction")).toBe("Ciencia ficción");
    expect(generoEs("Kung Fu")).toBe("Kung Fu");
  });
  it("todo género conocido tiene color de 6 dígitos y el desconocido cae a gris", () => {
    expect(colorGenero("Drama")).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorGenero("Kung Fu")).toBe(COLOR_GENERO_DESCONOCIDO);
  });
  it("los filtros de la galaxia excluyen los cajones de sastre y son 12", () => {
    expect(GENEROS_FILTRABLES).toHaveLength(12);
    expect(GENEROS_FILTRABLES).not.toContain("Otro");
    expect(GENEROS_FILTRABLES).not.toContain("TV Movie");
  });
});
