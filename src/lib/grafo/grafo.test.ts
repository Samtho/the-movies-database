import { describe, expect, it } from "vitest";
import type { Nodo } from "../schema";
import { aMundo, aPantalla, arrastrar, nodoEnGlobal, zoomEn, ZOOM_MAX, ZOOM_MIN, type Camara } from "./camara";
import { caminoMasCorto, gradosDeSeparacion } from "./camino";
import { buscarNodos, construirAdyacencia, focoInicial, rolDe, vecinosOrdenados, vistasDePersona } from "./estructura";
import { interpolar, layoutRueda, nodoEnRueda } from "./rueda";

const peli = (l: string, v: 0 | 1, a = 2000, x = 0, y = 0): Nodo => ({ t: "m", id: a, l, v, a, p: null, x, y });
const persona = (l: string, v: number, t: "a" | "d" = "a", x = 0, y = 0): Nodo => ({ t, l, v, x, y, f: null });

// Tom -(0)- Toy(1) -(2)- Tim ; Tom - Big(3) ; Suelto(4) sin aristas ; Ana(5) - Otra(6)
const nodes: Nodo[] = [persona("Tom Hanks", 2), peli("Toy Story", 1, 1995), persona("Tim Allen", 1), peli("Big", 1, 1988), persona("Suelto", 0), persona("Ána", 0, "d"), peli("Otra", 0, 2010)];
const links: [number, number][] = [[0, 1], [1, 2], [0, 3], [5, 6]];
const ady = construirAdyacencia(nodes.length, links);

describe("construirAdyacencia", () => {
  it("no dirigida", () => expect(ady[1]).toEqual([0, 2]));
  it("ignora aristas fuera de rango y bucles", () => {
    expect(construirAdyacencia(2, [[0, 1], [0, 5], [-1, 0], [1, 1]])).toEqual([[1], [0]]);
  });
  it("grafo vacío", () => expect(construirAdyacencia(0, [])).toEqual([]));
});

describe("focoInicial", () => {
  it("la persona con más vistas", () => expect(focoInicial(nodes)).toBe(0));
  it("sin personas: el primer nodo", () => expect(focoInicial([peli("A", 0), peli("B", 1)])).toBe(0));
  it("vacío: null", () => expect(focoInicial([])).toBeNull());
});

describe("vecinosOrdenados", () => {
  it("vistos primero, luego más recientes", () => expect(vecinosOrdenados(ady, nodes, 0)).toEqual([1, 3]));
  it("limita la rueda", () => expect(vecinosOrdenados(ady, nodes, 0, 1)).toEqual([1]));
  it("nodo sin vecinos o inexistente", () => {
    expect(vecinosOrdenados(ady, nodes, 4)).toEqual([]);
    expect(vecinosOrdenados(ady, nodes, 99)).toEqual([]);
  });
});

describe("caminoMasCorto", () => {
  it("entre dos personas por una película común", () => {
    const c = caminoMasCorto(ady, 0, 2);
    expect(c).toEqual([0, 1, 2]);
    expect(gradosDeSeparacion(c!)).toBe(1);
  });
  it("mismo nodo: camino de uno y 0 grados", () => {
    expect(caminoMasCorto(ady, 3, 3)).toEqual([3]);
    expect(gradosDeSeparacion([3])).toBe(0);
  });
  it("sin conexión", () => {
    expect(caminoMasCorto(ady, 0, 4)).toBeNull();
    expect(caminoMasCorto(ady, 0, 6)).toBeNull();
  });
  it("índices inexistentes", () => {
    expect(caminoMasCorto(ady, -1, 2)).toBeNull();
    expect(caminoMasCorto(ady, 0, 99)).toBeNull();
  });
  it("con empates, determinista (primer vecino de la lista)", () => {
    // 0-1-3 y 0-2-3 miden lo mismo
    const a = construirAdyacencia(4, [[0, 1], [0, 2], [1, 3], [2, 3]]);
    expect(caminoMasCorto(a, 0, 3)).toEqual([0, 1, 3]);
  });
  it("camino largo en una cadena de 10.000 nodos", () => {
    const n = 10_000;
    const cadena = construirAdyacencia(n, Array.from({ length: n - 1 }, (_, i) => [i, i + 1] as [number, number]));
    expect(caminoMasCorto(cadena, 0, n - 1)).toHaveLength(n);
  });
});

describe("buscarNodos", () => {
  it("sin tildes, más vistos primero", () => {
    expect(buscarNodos(nodes, "ana").map((r) => r.i)).toEqual([5]);
    expect(buscarNodos(nodes, "t").map((r) => r.i)).toEqual([]); // menos de 2 letras
    expect(buscarNodos(nodes, "to").map((r) => r.n.l)).toEqual(["Tom Hanks", "Toy Story", "Suelto"]); // subcadena en cualquier parte
  });
});

describe("vistasDePersona y rolDe", () => {
  it("cuenta las películas vistas de una persona", () => expect(vistasDePersona(ady, nodes, 0)).toEqual({ vistas: 2, total: 2 }));
  it("persona sin películas", () => expect(vistasDePersona(ady, nodes, 4)).toEqual({ vistas: 0, total: 0 }));
  it("para una película o un índice inexistente, null", () => {
    expect(vistasDePersona(ady, nodes, 1)).toBeNull();
    expect(vistasDePersona(ady, nodes, 99)).toBeNull();
  });
  it("roles", () => expect(nodes.slice(0, 2).map(rolDe).concat(rolDe(nodes[5]))).toEqual(["actor/actriz", "película", "director/a"]));
});

describe("rueda", () => {
  const pos = layoutRueda(800, 600, 0, [1, 3]);
  it("foco en el centro, más grande, y vecinos a la misma distancia", () => {
    expect(pos.get(0)).toEqual({ x: 400, y: 292, escala: 1.6 });
    const d = (i: number) => Math.hypot(pos.get(i)!.x - 400, pos.get(i)!.y - 292);
    expect(d(1)).toBeCloseTo(d(3));
  });
  it("sin foco: vacío; el foco no se repite como vecino", () => {
    expect(layoutRueda(800, 600, null, [1]).size).toBe(0);
    expect(layoutRueda(800, 600, 0, [0, 1]).size).toBe(2);
  });
  it("clic: dentro del radio, el más cercano; fuera, null", () => {
    expect(nodoEnRueda(pos, nodes, 400, 292)).toBe(0);
    expect(nodoEnRueda(pos, nodes, 400 + 57, 292)).toBeNull(); // radio de persona foco: 30 × 1,6 = 48
    const p1 = pos.get(1)!;
    expect(nodoEnRueda(pos, nodes, p1.x + 37, p1.y)).toBe(1); // póster: radio 38
  });
  it("interpolar: extremos y valores fuera de rango", () => {
    const a = { x: 0, y: 0, escala: 1 }, b = { x: 10, y: 20, escala: 2 };
    expect(interpolar(a, b, 0, a)).toEqual(a);
    expect(interpolar(a, b, 1, a)).toEqual(b);
    expect(interpolar(a, b, 5, a)).toEqual(b);
    expect(interpolar(undefined, b, 0, { x: 1, y: 1, escala: 0.2 })).toEqual({ x: 1, y: 1, escala: 0.2 });
  });
});

describe("cámara global", () => {
  const c: Camara = { x: 10, y: 20, k: 2 };
  it("pantalla y mundo son inversas", () => {
    const [sx, sy] = aPantalla(c, 800, 600, 15, 25);
    expect(aMundo(c, 800, 600, sx, sy)).toEqual([15, 25]);
  });
  it("el zoom deja quieto el punto bajo el cursor", () => {
    const antes = aMundo(c, 800, 600, 100, 50);
    const z = zoomEn(c, 1.5, 800, 600, 100, 50);
    const despues = aMundo(z, 800, 600, 100, 50);
    expect(despues[0]).toBeCloseTo(antes[0]);
    expect(despues[1]).toBeCloseTo(antes[1]);
  });
  it("el zoom está acotado", () => {
    expect(zoomEn(c, 1000, 800, 600, 0, 0).k).toBe(ZOOM_MAX);
    expect(zoomEn(c, 0.0001, 800, 600, 0, 0).k).toBe(ZOOM_MIN);
  });
  it("arrastrar mueve en sentido contrario al gesto y respeta el zoom", () => {
    expect(arrastrar(c, 20, -10)).toEqual({ x: 0, y: 25, k: 2 });
  });
  it("clic en vista global: el nodo más cercano dentro del radio", () => {
    const ns = [persona("A", 0, "a", 0, 0), persona("B", 0, "a", 3, 0)];
    const cam = { x: 0, y: 0, k: 1 };
    expect(nodoEnGlobal(ns, cam, 100, 100, 50 + 2, 50)).toBe(1);
    expect(nodoEnGlobal(ns, cam, 100, 100, 50 + 40, 50)).toBeNull();
    expect(nodoEnGlobal([], cam, 100, 100, 50, 50)).toBeNull();
  });
});
