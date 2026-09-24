// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR, TOKEN_CSS, hexARgba } from "./theme";

describe("paleta", () => {
  const css = readFileSync(join(import.meta.dirname, "../index.css"), "utf8");
  it.each(Object.keys(COLOR) as (keyof typeof COLOR)[])("%s coincide con su token en index.css", (clave) => {
    const m = new RegExp(`--color-${TOKEN_CSS[clave]}:\\s*(#[0-9a-fA-F]{3,6})`).exec(css);
    expect(m?.[1]?.toLowerCase()).toBe(COLOR[clave]);
  });
});

describe("hexARgba", () => {
  it.each([
    ["#f0b429", 255, [240, 180, 41, 255]],
    ["#777", 95, [119, 119, 119, 95]], // 3 dígitos (antes daba NaN en la galaxia)
    ["f0b429", 255, [240, 180, 41, 255]], // sin almohadilla
    ["#zzzzzz", 255, [102, 102, 102, 255]], // inválido: gris, nunca NaN
    ["", 10, [102, 102, 102, 10]],
  ] as const)("%s (alfa %s)", (hex, alfa, esperado) => expect(hexARgba(hex, alfa)).toEqual(esperado));
});
