// "La industria": agregados del EDA de The Movies Dataset.
import type { Industria } from "./schema";

type Fila = Industria["serie"][number];
export const MINIMO_PELICULAS_POR_GENERO = 50; // por debajo, la media por género es ruido

// Géneros con más películas en todo el periodo; empate: alfabético.
export function generosPrincipales(serie: readonly Fila[], n = 10): string[] {
  const c = new Map<string, number>();
  for (const r of serie) c.set(r.g, (c.get(r.g) ?? 0) + r.n);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([g]) => g);
}

// Películas estrenadas por año desde `desde` (opcionalmente de un género), años ordenados.
export function produccionPorAnio(serie: readonly Fila[], desde: number, genero: string | null): { anio: number; n: number }[] {
  const porAnio = new Map<number, number>();
  for (const r of serie) {
    if (r.y < desde || (genero && r.g !== genero)) continue;
    porAnio.set(r.y, (porAnio.get(r.y) ?? 0) + r.n);
  }
  return [...porAnio.entries()].sort((a, b) => a[0] - b[0]).map(([anio, n]) => ({ anio, n }));
}

// Nota media ponderada por nº de películas, por género, desde `desde`. Solo géneros con
// al menos `minimo` películas; de mayor a menor nota, como mucho `top`.
export function notaMediaPorGenero(serie: readonly Fila[], desde: number, minimo = MINIMO_PELICULAS_POR_GENERO, top = 12) {
  const acc = new Map<string, { n: number; suma: number }>();
  for (const r of serie) {
    if (r.y < desde || r.n <= 0) continue;
    const cur = acc.get(r.g) ?? { n: 0, suma: 0 };
    acc.set(r.g, { n: cur.n + r.n, suma: cur.suma + r.va * r.n });
  }
  return [...acc.entries()]
    .filter(([, v]) => v.n >= minimo)
    .map(([g, v]) => ({ g, nota: v.suma / v.n, n: v.n }))
    .sort((a, b) => b.nota - a.nota || a.g.localeCompare(b.g))
    .slice(0, top);
}

// Puntos presupuesto/taquilla dibujables en escala logarítmica (ambos > 0).
export function puntosInversion(scatter: Industria["scatter"]) {
  return scatter
    .filter(([, , , presupuesto, taquilla]) => presupuesto > 0 && taquilla > 0)
    .map(([id, titulo, anio, presupuesto, taquilla]) => ({ id, nombre: `${titulo} (${anio})`, value: [presupuesto, taquilla] as [number, number] }));
}
