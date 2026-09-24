import { describe, expect, it } from "vitest";
import { generosPrincipales, notaMediaPorGenero, produccionPorAnio, puntosInversion } from "./industria";

const f = (y: number, g: string, n: number, va = 6) => ({ y, g, n, va, rev: 0 });
const serie = [f(1950, "Drama", 10, 7), f(1990, "Drama", 40, 6), f(1990, "Comedy", 60, 5), f(2000, "Comedy", 5, 9), f(1990, "War", 3, 8)];

describe("generosPrincipales", () => {
  it("por nº total de películas", () => expect(generosPrincipales(serie)).toEqual(["Comedy", "Drama", "War"]));
  it("limitado", () => expect(generosPrincipales(serie, 1)).toEqual(["Comedy"]));
  it("vacía", () => expect(generosPrincipales([])).toEqual([]));
});

describe("produccionPorAnio", () => {
  it("suma géneros por año y ordena", () => {
    expect(produccionPorAnio(serie, 1900, null)).toEqual([{ anio: 1950, n: 10 }, { anio: 1990, n: 103 }, { anio: 2000, n: 5 }]);
  });
  it("respeta 'desde' (inclusive) y el género", () => {
    expect(produccionPorAnio(serie, 1990, "Comedy")).toEqual([{ anio: 1990, n: 60 }, { anio: 2000, n: 5 }]);
  });
  it("sin datos para el filtro", () => expect(produccionPorAnio(serie, 2010, null)).toEqual([]));
});

describe("notaMediaPorGenero", () => {
  it("media ponderada por nº de películas", () => {
    const r = notaMediaPorGenero(serie, 1900, 1);
    const drama = r.find((x) => x.g === "Drama");
    expect(drama?.nota).toBeCloseTo((10 * 7 + 40 * 6) / 50);
    expect(drama?.n).toBe(50);
  });
  it("descarta géneros con menos del mínimo", () => {
    expect(notaMediaPorGenero(serie, 1900, 50).map((x) => x.g)).toEqual(["Drama", "Comedy"]);
  });
  it("ordena de mayor a menor nota y limita", () => {
    const r = notaMediaPorGenero(serie, 1900, 1);
    expect(r.map((x) => x.g)).toEqual(["War", "Drama", "Comedy"]);
    expect(notaMediaPorGenero(serie, 1900, 1, 1)).toHaveLength(1);
  });
  it("ignora filas con n = 0 (no divide por cero)", () => {
    expect(notaMediaPorGenero([f(2000, "X", 0, 9)], 1900, 0)).toEqual([]);
  });
});

describe("puntosInversion", () => {
  it("solo puntos con presupuesto y taquilla positivos", () => {
    const r = puntosInversion([[1, "A", 2000, 10, 20, 7], [2, "B", 2001, 0, 20, 7], [3, "C", 2002, 10, 0, 7], [4, "D", 2003, -1, 5, 7]]);
    expect(r).toEqual([{ id: 1, nombre: "A (2000)", value: [10, 20] }]);
  });
});
