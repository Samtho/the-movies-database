import { describe, expect, it } from "vitest";
import { ficha } from "../test/fixtures";
import {
  buscarPeliculas, decadasDe, elegirSorpresa, filtrarCandidatas, generosFrecuentes,
  MINUTOS_MAX, unirCandidatas, type CandidataConFicha, type FiltrosNoche,
} from "./noche";

const cand = (id: number, f: Parameters<typeof ficha>[0], s = 0.5): CandidataConFicha => ({ id, s, r: [], f: ficha(f) });

describe("unirCandidatas", () => {
  it("descarta las que no tienen ficha y conserva el orden", () => {
    const fichas = { "1": ficha({ t: "A" }), "3": ficha({ t: "C" }) };
    const res = unirCandidatas([{ id: 3, s: 0.9, r: [] }, { id: 2, s: 0.8, r: [] }, { id: 1, s: 0.7, r: [] }], fichas);
    expect(res.map((c) => c.id)).toEqual([3, 1]);
  });
  it("lista vacía", () => expect(unirCandidatas([], {})).toEqual([]));
});

describe("filtrarCandidatas", () => {
  const lista = [
    cand(1, { g: ["Drama", "Comedy"], a: 1995, rt: 90 }),
    cand(2, { g: ["Horror"], a: 1958, rt: 200 }),
    cand(3, { g: ["Comedy"], a: 2021, rt: null }),
    cand(4, { g: ["Drama"], a: 1999, rt: 0 }),
    cand(5, { g: ["Drama"], a: 2004, rt: 260 }),
  ];
  const sinFiltros: FiltrosNoche = { genero: null, decada: null, maxMinutos: MINUTOS_MAX };
  const ids = (f: Partial<FiltrosNoche>) => filtrarCandidatas(lista, { ...sinFiltros, ...f }).map((c) => c.id);

  it("sin filtros devuelve todo, incluidas las de más de 240 min", () => expect(ids({})).toEqual([1, 2, 3, 4, 5]));
  it("por género (en cualquiera de sus géneros)", () => expect(ids({ genero: "Comedy" })).toEqual([1, 3]));
  it("por década, incluidas las anteriores a 1960 y las de 2020", () => {
    expect(ids({ decada: 1950 })).toEqual([2]);
    expect(ids({ decada: 2020 })).toEqual([3]);
    expect(ids({ decada: 1990 })).toEqual([1, 4]);
  });
  it("por minutos: las de duración desconocida (null o 0) no se descartan", () => expect(ids({ maxMinutos: 100 })).toEqual([1, 3, 4]));
  it("filtros combinados sin resultados", () => expect(ids({ genero: "Horror", decada: 2020 })).toEqual([]));
});

describe("decadasDe", () => {
  it("únicas y ordenadas", () => {
    expect(decadasDe([cand(1, { a: 2021 }), cand(2, { a: 1958 }), cand(3, { a: 1955 })])).toEqual([1950, 2020]);
  });
  it("vacía", () => expect(decadasDe([])).toEqual([]));
});

describe("generosFrecuentes", () => {
  it("ordena por frecuencia y desempata alfabéticamente", () => {
    const l = [cand(1, { g: ["Drama", "Comedy"] }), cand(2, { g: ["Drama", "Action"] }), cand(3, { g: ["Comedy"] }), cand(4, { g: ["Action"] })];
    expect(generosFrecuentes(l)).toEqual(["Action", "Comedy", "Drama"]);
    expect(generosFrecuentes(l, 1)).toEqual(["Action"]);
  });
  it("películas sin géneros", () => expect(generosFrecuentes([cand(1, { g: [] })])).toEqual([]));
});

describe("elegirSorpresa", () => {
  const l = Array.from({ length: 500 }, (_, i) => cand(i + 1, {}));
  it.each([
    [0, 1], // primera
    [0.5, 201],
    [0.99999, 400], // nunca fuera del top-400
    [1, 400], // un azar mal acotado no se sale de la lista
  ])("azar %s -> id %s", (a, id) => expect(elegirSorpresa(l, () => a)).toBe(id));
  it("lista más corta que el tope", () => expect(elegirSorpresa(l.slice(0, 3), () => 0.99)).toBe(3));
  it("lista vacía: null", () => expect(elegirSorpresa([], () => 0.5)).toBeNull());
});

describe("buscarPeliculas", () => {
  const fichas = {
    "1": ficha({ t: "Amélie", nv: 5000 }),
    "2": ficha({ t: "Amelia", nv: 50 }),
    "3": ficha({ t: "The Godfather", nv: 9000 }),
  };
  it("sin tildes y con las más votadas primero", () => {
    expect(buscarPeliculas(fichas, "amel").map(([id]) => id)).toEqual([1, 2]);
  });
  it("respeta el límite", () => expect(buscarPeliculas(fichas, "amel", 1)).toHaveLength(1));
  it("menos de 2 caracteres: nada", () => expect(buscarPeliculas(fichas, "a")).toEqual([]));
  it("sin coincidencias", () => expect(buscarPeliculas(fichas, "zzz")).toEqual([]));
});
