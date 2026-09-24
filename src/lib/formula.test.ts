import { describe, expect, it } from "vitest";
import { anchoAuc, coefsLegibles, esModeloSimple, ordenarBenchmark, pesoMaximo } from "./formula";

describe("ordenarBenchmark", () => {
  it("de mejor a peor, desempate por nombre", () => {
    const r = ordenarBenchmark({ kNN: { auc: 0.81, std: 0.01 }, Logística: { auc: 0.87, std: 0.01 }, Árbol: { auc: 0.81, std: 0.02 } });
    expect(r.map((m) => m.nombre)).toEqual(["Logística", "Árbol", "kNN"]);
  });
  it("vacío", () => expect(ordenarBenchmark({})).toEqual([]));
});

describe("anchoAuc", () => {
  it.each([
    [0.87, 0.87, 1],
    [0.685, 0.87, 0.5],
    [0.5, 0.87, 0], // azar: barra vacía
    [0.4, 0.87, 0], // peor que el azar: acotado a 0
    [0.87, 0.5, 0], // mejor modelo = azar: sin división por cero
  ])("auc %s con mejor %s -> %s", (auc, mejor, esperado) => expect(anchoAuc(auc, mejor)).toBeCloseTo(esperado));
});

describe("coefsLegibles y pesoMaximo", () => {
  it("traduce los géneros y limita", () => {
    const r = coefsLegibles([{ f: "Género: Animation", w: -0.5 }, { f: "Nº de votos", w: 1.6 }, { f: "Género: Kung Fu", w: 0.1 }], 2);
    expect(r).toEqual([{ f: "Género: Animación", w: -0.5 }, { f: "Nº de votos", w: 1.6 }]);
  });
  it("peso máximo en valor absoluto; 0 si no hay", () => {
    expect(pesoMaximo([{ w: -2 }, { w: 1 }])).toBe(2);
    expect(pesoMaximo([])).toBe(0);
  });
});

describe("esModeloSimple", () => {
  it.each([
    ["Regresión logística", true],
    ["regresion logistica", true],
    ["Random Forest", false],
    [undefined, false],
  ])("%s -> %s", (n, esperado) => expect(esModeloSimple(n)).toBe(esperado));
});
