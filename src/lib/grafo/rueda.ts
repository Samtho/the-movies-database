// Modo explorar: el foco en el centro y sus vecinos en círculo (patrón Obsidian).
import type { Nodo } from "../schema";

export type Pos = { x: number; y: number; escala: number };

export const ESCALA_FOCO = 1.6;
const DESPLAZAMIENTO_Y = -8;

// Posiciones objetivo en píxeles CSS de un lienzo W×H.
export function layoutRueda(W: number, H: number, foco: number | null, vecinos: readonly number[]): Map<number, Pos> {
  const pos = new Map<number, Pos>();
  if (foco == null) return pos;
  const cx = W / 2, cy = H / 2 + DESPLAZAMIENTO_Y;
  pos.set(foco, { x: cx, y: cy, escala: ESCALA_FOCO });
  const R = Math.min(W, H) * 0.345;
  vecinos.forEach((ni, i) => {
    if (ni === foco) return;
    const ang = -Math.PI / 2 + (i / vecinos.length) * Math.PI * 2;
    pos.set(ni, { x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R, escala: 1 });
  });
  return pos;
}

// Radio de clic: los pósters son más grandes que las fotos de persona.
export const radioClic = (n: Nodo, escala: number): number => (n.t === "m" ? 38 : 30) * escala;

// Nodo bajo el puntero: el más cercano entre los que lo contienen; null si ninguno.
export function nodoEnRueda(pos: ReadonlyMap<number, Pos>, nodes: readonly Nodo[], mx: number, my: number): number | null {
  let mejor: number | null = null, mejorD = Number.POSITIVE_INFINITY;
  for (const [i, p] of pos) {
    const d = (mx - p.x) ** 2 + (my - p.y) ** 2;
    if (d <= radioClic(nodes[i], p.escala) ** 2 && d < mejorD) { mejor = i; mejorD = d; }
  }
  return mejor;
}

// Interpolación con salida suave (cúbica) entre dos posiciones; t en [0, 1].
export function interpolar(desde: Pos | undefined, hasta: Pos, t: number, origen: Pos): Pos {
  const a = desde ?? origen;
  const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  return { x: a.x + (hasta.x - a.x) * e, y: a.y + (hasta.y - a.y) * e, escala: a.escala + (hasta.escala - a.escala) * e };
}
