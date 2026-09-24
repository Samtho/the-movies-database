import { describe, expect, it } from "vitest";
import { fechaDeVista, formatoFecha, formatoNumero, numeroEnPalabras } from "./format";

describe("formatoFecha", () => {
  it.each([
    ["2026-06-14", "14/06/2026"],
    ["1991-07-01", "01/07/1991"],
    ["2026-06-14T21:30:00Z", "14/06/2026"], // con hora: se ignora
    ["", ""], // vacía: tal cual
    ["14/06/2026", "14/06/2026"], // otro formato: tal cual, no se inventa
    ["2026-6-1", "2026-6-1"], // sin ceros: tal cual
  ])("%s -> %s", (entrada, esperado) => expect(formatoFecha(entrada)).toBe(esperado));
});

describe("fechaDeVista", () => {
  it.each([
    ["2026-06-14", "el 14/06/2026"],
    [null, "sin fecha"], // fecha desconocida o carga en bloque
    ["", "sin fecha"],
  ])("%s -> %s", (entrada, esperado) => expect(fechaDeVista(entrada)).toBe(esperado));
});

describe("formatoNumero", () => {
  it.each([
    [1436, 0, "1.436"], // siempre con separador de miles, también en 4 cifras
    [171583, 0, "171.583"],
    [0.908, 3, "0,908"],
    [2.5, 1, "2,5"],
    [0, 0, "0"],
    [-3, 0, "-3"],
    [Number.NaN, 0, "–"],
    [Number.POSITIVE_INFINITY, 0, "–"],
  ])("%s con %s decimales -> %s", (n, d, esperado) => expect(formatoNumero(n, d)).toBe(esperado));
});

describe("numeroEnPalabras", () => {
  it.each([
    [0, "cero"], [1, "uno"], [9, "nueve"], [12, "doce"],
    [13, "13"], [1500, "1.500"], [-1, "-1"], [2.5, "3"],
  ])("%s -> %s", (n, esperado) => expect(numeroEnPalabras(n)).toBe(esperado));
  it("con mayúscula inicial", () => expect(numeroEnPalabras(9, { mayuscula: true })).toBe("Nueve"));
});
