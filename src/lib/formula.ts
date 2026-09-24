// "La fórmula de tu gusto": torneo de modelos, coeficientes y backtest.
import { generoEs } from "./generos";
import { maximo, proporcion } from "./numeros";
import type { Gusto } from "./schema";

// Modelos de mejor a peor AUC; empate: por nombre.
export function ordenarBenchmark(benchmark: Gusto["benchmark"]): { nombre: string; auc: number; std: number }[] {
  return Object.entries(benchmark)
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.auc - a.auc || a.nombre.localeCompare(b.nombre));
}

// Ancho relativo de la barra de AUC: 0,5 (azar) es el cero de la escala.
export const anchoAuc = (auc: number, mejor: number): number => proporcion(auc - 0.5, mejor - 0.5);

// Coeficientes con los géneros en español; como mucho `n`.
export function coefsLegibles(coefs: Gusto["coefs"], n = 14): { f: string; w: number }[] {
  return coefs.slice(0, n).map((c) => ({ ...c, f: c.f.startsWith("Género: ") ? `Género: ${generoEs(c.f.slice(8))}` : c.f }));
}

// Mayor |peso|, para escalar las barras (0 si no hay coeficientes: barras de ancho 0).
export const pesoMaximo = (coefs: readonly { w: number }[]): number => maximo(coefs.map((c) => Math.abs(c.w)));

// La regresión logística es "el modelo simple": el relato del capítulo cambia si gana otro.
export const esModeloSimple = (nombre: string | undefined): boolean => nombre != null && /regresi[oó]n log[ií]stica/i.test(nombre);
