import { describe, expect, it } from "vitest";
import { colorPunto, limites, puntoVisible, radioPunto, vistaInicial } from "./galaxia";
import type { GalaxiaPunto } from "./schema";

const p = (x: number, y: number, extra: Partial<GalaxiaPunto> = {}): GalaxiaPunto =>
  ({ id: 1, x, y, t: "T", a: 2000, g: "Drama", v: 0, s: 5, p: null, ...extra });

describe("limites", () => {
  it("sin puntos: null", () => expect(limites([])).toBeNull());
  it("un punto", () => expect(limites([p(2, 3)])).toEqual({ minX: 2, maxX: 2, minY: 3, maxY: 3 }));
  it("varios", () => expect(limites([p(-1, 5), p(4, -2), p(0, 0)])).toEqual({ minX: -1, maxX: 4, minY: -2, maxY: 5 }));
  it("70.000 puntos (más que el límite de argumentos de Safari)", () => {
    const muchos = Array.from({ length: 70_000 }, (_, i) => p(i, 1 - i));
    expect(limites(muchos)).toEqual({ minX: 0, maxX: 69_999, minY: -69_998, maxY: 1 });
  });
});

describe("vistaInicial", () => {
  it("centra y ajusta el zoom al 90% del alto", () => {
    const v = vistaInicial({ minX: 0, maxX: 10, minY: 0, maxY: 20 }, 900);
    expect(v.target).toEqual([5, 10, 0]);
    expect(v.zoom).toBeCloseTo(Math.log2(810 / 20));
  });
  it("sin puntos: origen y zoom 0", () => expect(vistaInicial(null, 900)).toEqual({ target: [0, 0, 0], zoom: 0 }));
  it("un solo punto: zoom 0, nunca Infinity", () => {
    const v = vistaInicial({ minX: 3, maxX: 3, minY: 4, maxY: 4 }, 900);
    expect(v).toEqual({ target: [3, 4, 0], zoom: 0 });
  });
  it("contenedor sin alto: usa un alto por defecto, nunca -Infinity", () => {
    expect(Number.isFinite(vistaInicial({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, 0).zoom)).toBe(true);
  });
});

describe("puntoVisible", () => {
  it.each([
    [{ v: 0 as const, g: "Drama" }, false, null, true],
    [{ v: 0 as const, g: "Drama" }, true, null, false],
    [{ v: 1 as const, g: "Drama" }, true, null, true],
    [{ v: 1 as const, g: "Drama" }, true, "Comedy", false],
    [{ v: 0 as const, g: "Comedy" }, false, "Comedy", true],
  ])("%j soloMias=%s genero=%s -> %s", (extra, solo, genero, esperado) => expect(puntoVisible(p(0, 0, extra), solo, genero)).toBe(esperado));
});

describe("estilo", () => {
  it("las vistas son más grandes y opacas", () => {
    expect(radioPunto(p(0, 0, { v: 1 }))).toBeGreaterThan(radioPunto(p(0, 0, { v: 0 })));
    expect(colorPunto(p(0, 0, { v: 1 }))[3]).toBe(255);
    expect(colorPunto(p(0, 0, { v: 0 }))[3]).toBe(95);
  });
  it("ningún género produce NaN (antes pasaba con los colores de 3 dígitos)", () => {
    for (const g of ["TV Movie", "Foreign", "Otro", "Inventado"]) expect(colorPunto(p(0, 0, { g })).every(Number.isFinite)).toBe(true);
  });
});
