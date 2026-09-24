import { describe, expect, it } from "vitest";
import { coincide, normalizar } from "./texto";

describe("normalizar", () => {
  it.each([
    ["Amélie", "amelie"],
    ["  El VIAJE de Chihiro ", "el viaje de chihiro"],
    ["Pokémon: Mewtwo", "pokemon: mewtwo"],
    ["Ñandú", "nandu"],
    ["", ""],
  ])("%s -> %s", (e, s) => expect(normalizar(e)).toBe(s));
});

describe("coincide", () => {
  it("ignora tildes y mayúsculas en ambos lados", () => {
    expect(coincide("amelie", "Amélie")).toBe(true);
    expect(coincide("AMÉLIE", "amelie")).toBe(true);
  });
  it("busca en cualquiera de los textos (título original o en español)", () => {
    expect(coincide("padrino", "The Godfather", "El padrino")).toBe(true);
    expect(coincide("padrino", "The Godfather", null, undefined)).toBe(false);
  });
  it("exige al menos 2 caracteres útiles", () => {
    expect(coincide("a", "Amélie")).toBe(false);
    expect(coincide("   ", "Amélie")).toBe(false);
    expect(coincide("am", "Amélie")).toBe(true);
  });
});
