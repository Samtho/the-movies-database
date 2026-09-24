// @vitest-environment node
import { describe, expect, it } from "vitest";
import { leer } from "./leer";

// Invariantes entre archivos: el esquema valida la forma de cada JSON; esto valida
// que los 8 cuenten la misma historia. Protegen el refresco de datos.
const fichas = leer("fichas");
const vistas = leer("vistas");
const gusto = leer("gusto");
const similares = leer("similares");
const grafo = leer("grafo");
const galaxia = leer("galaxia");
const stats = leer("stats");

const tieneFicha = (id: number) => String(id) in fichas;
const vista = (id: number) => String(id) in vistas;
const duplicados = <T,>(xs: T[]) => xs.length - new Set(xs).size;

describe("candidatas de 'Esta noche'", () => {
  const ids = gusto.candidatos.map((c) => c.id);
  it("1. no tienen ids repetidos", () => expect(duplicados(ids)).toBe(0));
  it("2. todas tienen ficha", () => expect(ids.filter((id) => !tieneFicha(id))).toEqual([]));
  it("3. ninguna está ya vista", () => {
    expect(ids.filter(vista)).toEqual([]);
    expect(ids.filter((id) => fichas[String(id)]?.v === 1)).toEqual([]);
  });
  it("4. vienen ordenadas por score descendente", () => {
    const desordenadas = gusto.candidatos.filter((c, i) => i > 0 && c.s > gusto.candidatos[i - 1].s);
    expect(desordenadas).toEqual([]);
  });
  it("5b. el backtest conservador nunca supera a su techo", () => {
    expect(gusto.backtest.top10).toBeLessThanOrEqual(gusto.backtest.techo.top10);
    expect(gusto.segunda_etapa.notas).toBeLessThanOrEqual(gusto.segunda_etapa.notas_totales);
  });
  it("5. sus porqués apuntan a la leyenda", () => {
    const fuera = gusto.candidatos.filter((c) => c.r.some((i) => i < 0 || i >= gusto.leyenda.length));
    expect(fuera).toEqual([]);
  });
});

describe("similares", () => {
  it("6. claves y sugerencias tienen ficha", () => {
    const rotas = Object.entries(similares).filter(([k, l]) => !(k in fichas) || l.some((id) => !tieneFicha(id)));
    expect(rotas.map(([k]) => k)).toEqual([]);
  });
  it("7. ninguna película es similar de sí misma ni se repite", () => {
    const malas = Object.entries(similares).filter(([k, l]) => l.includes(Number(k)) || duplicados(l) > 0);
    expect(malas.map(([k]) => k)).toEqual([]);
  });
});

describe("grafo", () => {
  const n = grafo.nodes.length;
  it("8. aristas en rango, sin bucles, sin duplicadas y siempre película-persona", () => {
    const claves = grafo.links.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`));
    expect(grafo.links.filter(([a, b]) => a < 0 || b < 0 || a >= n || b >= n || a === b)).toEqual([]);
    expect(duplicados(claves)).toBe(0);
    expect(grafo.links.filter(([a, b]) => (grafo.nodes[a].t === "m") === (grafo.nodes[b].t === "m"))).toEqual([]);
  });
  it("9. sus películas tienen ficha y su 'vista' coincide con el historial", () => {
    const pelis = grafo.nodes.filter((x) => x.t === "m");
    expect(pelis.filter((x) => !tieneFicha(x.id)).map((x) => x.id)).toEqual([]);
    expect(pelis.filter((x) => (x.v === 1) !== vista(x.id)).map((x) => x.id)).toEqual([]);
  });
  it("10. cada persona cuenta cuántas de sus películas has visto", () => {
    const ady: number[][] = grafo.nodes.map(() => []);
    for (const [a, b] of grafo.links) { ady[a].push(b); ady[b].push(a); }
    const mal = grafo.nodes.flatMap((x, i) => {
      if (x.t === "m") return [];
      const vistas = ady[i].filter((j) => grafo.nodes[j].v === 1).length;
      return vistas === x.v ? [] : [`${x.l}: ${x.v} != ${vistas}`];
    });
    expect(mal).toEqual([]);
  });
});

describe("fichas y galaxia frente al historial", () => {
  it("11. una ficha está marcada como vista si y solo si está en el historial", () => {
    const mal = Object.entries(fichas).filter(([id, f]) => (f.v === 1) !== (id in vistas));
    expect(mal.map(([id]) => id)).toEqual([]);
    expect(Object.keys(vistas).filter((id) => !(id in fichas))).toEqual([]);
  });
  it("12. la galaxia no repite películas y solo enciende las vistas", () => {
    expect(duplicados(galaxia.map((p) => p.id))).toBe(0);
    expect(galaxia.filter((p) => p.v === 1 && !vista(p.id)).map((p) => p.id)).toEqual([]);
  });
});

describe("stats", () => {
  it("13. los totales cuadran entre sí y con el historial", () => {
    const sumaMensual = stats.mensual.reduce((a, [, n]) => a + n, 0);
    const sumaDiaHora = stats.semana_hora.flat().reduce((a, n) => a + n, 0);
    expect(sumaMensual).toBe(stats.fechados); // la línea temporal solo lleva fechas fiables
    expect(stats.fechados).toBeLessThanOrEqual(stats.plays);
    expect(sumaDiaHora).toBe(stats.horas_registradas); // solo los visionados con hora real
    expect(stats.horas_registradas).toBeLessThanOrEqual(stats.fechados);
    expect(stats.total_vistas).toBe(Object.keys(vistas).length);
    expect(stats.match_dataset + stats.post2017).toBe(stats.total_vistas);
  });
  it("14. los derivados coinciden con su fuente", () => {
    expect(stats.resumen.universo).toBe(galaxia.length);
    expect(stats.resumen.modelos).toBe(Object.keys(gusto.benchmark).length);
    expect(stats.resumen.auc).toBeCloseTo(gusto.auc_cv[0], 3);
    expect(stats.muro.filter((m) => fichas[String(m.id)]?.p !== m.p)).toEqual([]);
  });
  it("15. ninguna fecha de visionado es futura", () => {
    const hoy = new Date().toISOString().slice(0, 10);
    expect(Object.entries(vistas).filter(([, v]) => v.d !== null && v.d > hoy)).toEqual([]);
  });
  it("16. las vistas sin fecha no pasan del total y el backtest las deja fuera", () => {
    const sinFecha = Object.values(vistas).filter((v) => v.d === null).length;
    expect(sinFecha).toBeLessThan(stats.total_vistas);
    expect(gusto.backtest.n_sin_fecha).toBeLessThanOrEqual(stats.match_dataset);
    expect(stats.mensual.map(([mes]) => mes)).not.toContain("1970-01"); // la "fecha desconocida" de Trakt
  });
});
