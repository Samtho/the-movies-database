// Modo vista global: cámara 2D (centro en coordenadas del grafo y zoom k).
import type { Nodo } from "../schema";

export type Camara = { x: number; y: number; k: number };
export const CAMARA_INICIAL: Camara = { x: 0, y: 0, k: 0.55 };
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 9;

export const aPantalla = (c: Camara, W: number, H: number, x: number, y: number): [number, number] =>
  [W / 2 + (x - c.x) * c.k, H / 2 + (y - c.y) * c.k];

export const aMundo = (c: Camara, W: number, H: number, sx: number, sy: number): [number, number] =>
  [(sx - W / 2) / c.k + c.x, (sy - H / 2) / c.k + c.y];

// Zoom anclado al puntero: el punto bajo el cursor queda quieto. Acotado a [ZOOM_MIN, ZOOM_MAX].
export function zoomEn(c: Camara, factor: number, W: number, H: number, sx: number, sy: number): Camara {
  const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.k * factor));
  const [wx, wy] = aMundo(c, W, H, sx, sy);
  return { k, x: wx - (sx - W / 2) / k, y: wy - (sy - H / 2) / k };
}

// Arrastre en píxeles de pantalla.
export const arrastrar = (c: Camara, dx: number, dy: number): Camara => ({ ...c, x: c.x - dx / c.k, y: c.y - dy / c.k });

// Nodo más cercano al puntero dentro de `radioPx` píxeles de pantalla; null si ninguno.
export function nodoEnGlobal(nodes: readonly Nodo[], c: Camara, W: number, H: number, sx: number, sy: number, radioPx = 10): number | null {
  const [wx, wy] = aMundo(c, W, H, sx, sy);
  let mejor: number | null = null, mejorD = (radioPx / c.k) ** 2;
  for (let i = 0; i < nodes.length; i++) {
    const d = (nodes[i].x - wx) ** 2 + (nodes[i].y - wy) ** 2;
    if (d <= mejorD) { mejorD = d; mejor = i; }
  }
  return mejor;
}
