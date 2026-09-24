// Estructura del grafo película-persona: vecinos, foco inicial y búsqueda.
import type { Nodo } from "../schema";
import { coincide } from "../texto";

// Lista de adyacencia. Las aristas con índices fuera de rango o bucles se ignoran.
export function construirAdyacencia(n: number, links: readonly (readonly [number, number])[]): number[][] {
  const ady: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of links) {
    if (a === b || a < 0 || b < 0 || a >= n || b >= n) continue;
    ady[a].push(b);
    ady[b].push(a);
  }
  return ady;
}

// Foco inicial: la persona con más películas vistas; sin personas, el primer nodo; grafo vacío, null.
export function focoInicial(nodes: readonly Nodo[]): number | null {
  if (nodes.length === 0) return null;
  let mejor = -1, valor = -1;
  nodes.forEach((n, i) => { if (n.t !== "m" && n.v > valor) { valor = n.v; mejor = i; } });
  return mejor >= 0 ? mejor : 0;
}

const anioDe = (n: Nodo) => (n.t === "m" ? n.a : 0);

// Vecinos del foco para la rueda: más vistos primero, luego más recientes, luego por nombre.
export function vecinosOrdenados(ady: readonly number[][], nodes: readonly Nodo[], foco: number, maximo = 18): number[] {
  return [...(ady[foco] ?? [])]
    .sort((a, b) => nodes[b].v - nodes[a].v || anioDe(nodes[b]) - anioDe(nodes[a]) || nodes[a].l.localeCompare(nodes[b].l))
    .slice(0, maximo);
}

// Búsqueda por nombre (sin tildes ni mayúsculas): primero los más vistos, luego por nombre.
export function buscarNodos(nodes: readonly Nodo[], consulta: string, limite = 6): { n: Nodo; i: number }[] {
  const res: { n: Nodo; i: number }[] = [];
  nodes.forEach((n, i) => { if (coincide(consulta, n.l)) res.push({ n, i }); });
  return res.sort((a, b) => b.n.v - a.n.v || a.n.l.localeCompare(b.n.l)).slice(0, limite);
}

// Para una persona: cuántas de sus películas (en el grafo) has visto. Para una película, null.
export function vistasDePersona(ady: readonly number[][], nodes: readonly Nodo[], i: number): { vistas: number; total: number } | null {
  if (nodes[i]?.t !== "d" && nodes[i]?.t !== "a") return null;
  const vecinos = ady[i] ?? [];
  return { vistas: vecinos.filter((j) => nodes[j].v === 1).length, total: vecinos.length };
}

export const rolDe = (n: Nodo): string => (n.t === "m" ? "película" : n.t === "d" ? "director/a" : "actor/actriz");
