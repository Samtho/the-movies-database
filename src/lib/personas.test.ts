import { describe, expect, it } from "vitest";
import { ficha } from "../test/fixtures";
import { filmografia, ultimaVista } from "./personas";

const fichas = {
  "1": ficha({ t: "B", a: 2000, d: "Ana", dp: "/ana-dir.jpg", c: ["Ana", "Luis"], cp: ["/ana-act.jpg", null], v: 0 }),
  "2": ficha({ t: "A", a: 2010, d: "Otro", c: ["Luis", "Ana"], cp: [null, "/ana2.jpg"], v: 1 }),
  "3": ficha({ t: "C", a: 2010, d: "Otro", c: ["Ana"], cp: [null], v: 0 }),
  "4": ficha({ t: "D", a: 1990, d: "Otro", c: ["Pedro"], v: 1 }),
};

describe("filmografia", () => {
  it("dirige y actúa en la misma película: cuenta una vez, como dirige", () => {
    const { pelis } = filmografia("Ana", fichas);
    expect(pelis.filter((p) => p.id === 1)).toEqual([expect.objectContaining({ rol: "dirige" })]);
  });
  it("ordena: vistas primero, luego más recientes, luego por título", () => {
    expect(filmografia("Ana", fichas).pelis.map((p) => p.id)).toEqual([2, 3, 1]);
  });
  it("la foto sale de la primera película que la tenga", () => {
    expect(filmografia("Ana", fichas).foto).toBe("/ana-dir.jpg");
    expect(filmografia("Luis", fichas).foto).toBeNull();
  });
  it("coincidencia exacta de nombre (no parcial)", () => expect(filmografia("An", fichas).pelis).toEqual([]));
  it("persona inexistente", () => expect(filmografia("Nadie", fichas)).toEqual({ pelis: [], foto: null }));
});

describe("ultimaVista", () => {
  const { pelis } = filmografia("Ana", fichas);
  it("la fecha más reciente de las vistas", () => {
    expect(ultimaVista(pelis, { "2": { d: "2020-01-05", n: 1 }, "3": { d: "2021-03-01", n: 2 } })).toBe("2021-03-01");
  });
  it("ninguna vista", () => expect(ultimaVista(pelis, {})).toBeNull());
  it("sin películas", () => expect(ultimaVista([], { "2": { d: "2020-01-05", n: 1 } })).toBeNull());
});
