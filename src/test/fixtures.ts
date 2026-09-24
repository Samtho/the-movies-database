import { vi } from "vitest";
import { vaciarCacheDeDatos } from "../lib/data";
import type { Datos, Ficha, Gusto, NombreArchivo, Stats } from "../lib/schema";

// Ficha mínima para tests; se sobrescribe lo que cada caso necesite.
export function ficha(parcial: Partial<Ficha> = {}): Ficha {
  return { t: "Película", a: 2000, g: ["Drama"], d: null, c: [], rt: 100, va: 7, nv: 100, p: null, o: "", v: 0, ...parcial };
}

export function stats(parcial: Partial<Stats> = {}): Stats {
  return {
    total_vistas: 10, plays: 12, minutos: 1200, match_dataset: 8, post2017: 2,
    mensual: [["2026-01", 12]], semana_hora: Array.from({ length: 7 }, () => Array<number>(24).fill(0)), horas_registradas: 0,
    decadas: [[2000, 10]], rewatch: [], top_directores: [], top_actores: [], top_generos: [], ratings: [],
    muro: [], resumen: { universo: 100, auc: 0.9, auc_std: 0.01, modelos: 2 },
    ...parcial,
  };
}

export function gusto(parcial: Partial<Gusto> = {}): Gusto {
  return {
    benchmark: { "Regresión logística": { auc: 0.87, std: 0.01 }, kNN: { auc: 0.8, std: 0.02 } },
    auc_cv: [0.9, 0.01], coefs: [{ f: "Nº de votos", w: 1 }], candidatos: [], leyenda: [],
    backtest: {
      corte: "2015-01-01", n_test: 10, n_cand: 100, mediana_pct: 2, top10: 60, top20: 70, p100: 7, p300: 9, p500: 10, azar100: 2.5,
      techo: { mediana_pct: 1, top10: 80, top20: 90, p100: 9 }, metodo: 2,
    },
    segunda_etapa: { activa: false, notas: 5, notas_totales: 5, umbral: 150 },
    ...parcial,
  };
}

// Sirve datos falsos a cargar(): cada archivo pedido devuelve su fixture (o 404).
export function servirDatos(datos: { [N in NombreArchivo]?: Datos<N> }) {
  vaciarCacheDeDatos();
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const nombre = /data\/(\w+)\.json/.exec(url)?.[1] as NombreArchivo | undefined;
    const cuerpo = nombre ? datos[nombre] : undefined;
    return Promise.resolve(cuerpo === undefined ? new Response("no existe", { status: 404 }) : new Response(JSON.stringify(cuerpo)));
  }));
}
