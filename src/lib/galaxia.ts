// "La galaxia": geometría y estilo de los puntos (sin deck.gl, para poder testearlo).
import { colorGenero } from "./generos";
import { maximo, minimo } from "./numeros";
import type { GalaxiaPunto } from "./schema";
import { hexARgba, type Rgba } from "./theme";

export type Limites = { minX: number; maxX: number; minY: number; maxY: number };

// Caja que contiene todos los puntos; null si no hay puntos.
export function limites(puntos: readonly { x: number; y: number }[]): Limites | null {
  if (puntos.length === 0) return null;
  const xs = puntos.map((p) => p.x), ys = puntos.map((p) => p.y);
  return { minX: minimo(xs), maxX: maximo(xs), minY: minimo(ys), maxY: maximo(ys) };
}

const ALTO_POR_DEFECTO = 600;

// Encuadre inicial: centrado y con zoom para que todo quepa en el 90% del alto.
// Con un solo punto (tamaño 0) o sin puntos, zoom 0; con alto 0 (contenedor oculto), alto por defecto.
export function vistaInicial(lim: Limites | null, altoPx: number): { target: [number, number, number]; zoom: number } {
  if (!lim) return { target: [0, 0, 0], zoom: 0 };
  const target: [number, number, number] = [(lim.minX + lim.maxX) / 2, (lim.minY + lim.maxY) / 2, 0];
  const tamano = Math.max(lim.maxX - lim.minX, lim.maxY - lim.minY);
  if (!(tamano > 0)) return { target, zoom: 0 };
  const alto = altoPx > 0 ? altoPx : ALTO_POR_DEFECTO;
  return { target, zoom: Math.log2((alto * 0.9) / tamano) };
}

export function puntoVisible(p: GalaxiaPunto, soloMias: boolean, genero: string | null): boolean {
  return (!soloMias || p.v === 1) && (!genero || p.g === genero);
}

// Las vistas, más grandes y opacas; el resto, tenues. El tamaño crece con la nota.
export const radioPunto = (p: GalaxiaPunto): number => (p.v ? 0.09 + p.s * 0.012 : 0.03 + p.s * 0.009);
export const colorPunto = (p: GalaxiaPunto): Rgba => hexARgba(colorGenero(p.g), p.v ? 255 : 95);
