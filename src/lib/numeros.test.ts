import { describe, expect, it } from "vitest";
import { maximo, minimo, proporcion } from "./numeros";

describe("maximo / minimo", () => {
  it.each([
    [[3, 1, 2], 3, 1],
    [[-5, -2], -2, -5],
    [[7], 7, 7],
    [[], 0, 0],
  ])("%j -> max %s, min %s", (xs, max, min) => {
    expect(maximo(xs)).toBe(max);
    expect(minimo(xs)).toBe(min);
  });
  it("valor para lista vacía configurable", () => {
    expect(maximo([], 1)).toBe(1);
    expect(minimo([], -1)).toBe(-1);
  });
  it("soporta listas mayores que el límite de argumentos del motor", () => {
    const grande = Array.from({ length: 200_000 }, (_, i) => i);
    expect(maximo(grande)).toBe(199_999);
    expect(minimo(grande)).toBe(0);
  });
});

describe("proporcion", () => {
  it.each([
    [5, 10, 0.5],
    [10, 10, 1],
    [15, 10, 1], // acotada
    [-1, 10, 0],
    [5, 0, 0], // total 0: 0, no Infinity
    [5, -3, 0],
    [Number.NaN, 10, 0],
    [5, Number.NaN, 0],
  ])("%s / %s -> %s", (v, t, esperado) => expect(proporcion(v, t)).toBe(esperado));
});
