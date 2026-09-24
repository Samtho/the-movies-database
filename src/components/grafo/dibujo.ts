// Dibujo del grafo en canvas 2D. Todo en píxeles CSS: el llamador ya aplicó la escala
// de densidad de pantalla (devicePixelRatio) al contexto.
import { aPantalla, type Camara } from "../../lib/grafo/camara";
import type { Pos } from "../../lib/grafo/rueda";
import type { Nodo } from "../../lib/schema";
import { COLOR } from "../../lib/theme";

export const COLOR_NODO = { vista: COLOR.marquee, pelicula: "#4a4a55", direccion: COLOR.blood, reparto: COLOR.leaf } as const;
export const colorDe = (n: Nodo): string =>
  n.t === "m" ? (n.v ? COLOR_NODO.vista : COLOR_NODO.pelicula) : n.t === "d" ? COLOR_NODO.direccion : COLOR_NODO.reparto;

const FUENTE = "Archivo, system-ui, sans-serif";
const POSTER = { w: 46, h: 69 };
const RADIO_PERSONA = 26;

// Caché de imágenes de TMDB para el canvas: devuelve la imagen si ya cargó y, si no,
// la pide y avisa (onCarga) cuando llega. Una imagen fallida no se vuelve a pedir.
export class CacheImagenes {
  private readonly imgs = new Map<string, HTMLImageElement | "cargando" | "fallo">();
  private readonly onCarga: () => void;
  constructor(onCarga: () => void) { this.onCarga = onCarga; }
  obtener(ruta: string, ancho: 92 | 154): HTMLImageElement | null {
    const clave = `${ancho}${ruta}`;
    const actual = this.imgs.get(clave);
    if (actual instanceof HTMLImageElement) return actual;
    if (actual) return null;
    const im = new Image();
    im.onload = () => { this.imgs.set(clave, im); this.onCarga(); };
    im.onerror = () => { this.imgs.set(clave, "fallo"); };
    im.src = `https://image.tmdb.org/t/p/w${ancho}${ruta}`;
    this.imgs.set(clave, "cargando");
    return null;
  }
}

function etiqueta(ctx: CanvasRenderingContext2D, n: Nodo, p: Pos, resaltada: boolean) {
  const bajo = p.y + (n.t === "m" ? (POSTER.h * p.escala) / 2 : RADIO_PERSONA * p.escala) + 15;
  ctx.fillStyle = resaltada ? COLOR.ivory : COLOR.ivoryDim;
  ctx.font = `11.5px ${FUENTE}`;
  ctx.textAlign = "center";
  ctx.fillText(n.l.length > 20 ? `${n.l.slice(0, 19)}…` : n.l, p.x, bajo);
  if (n.t === "m") {
    ctx.fillStyle = COLOR.faint;
    ctx.font = `10px ${FUENTE}`;
    ctx.fillText(String(n.a), p.x, bajo + 13);
  }
}

function nodoRueda(ctx: CanvasRenderingContext2D, n: Nodo, p: Pos, esFoco: boolean, esHover: boolean, imgs: CacheImagenes) {
  const esc = p.escala * (esHover && !esFoco ? 1.14 : 1);
  ctx.save();
  if (n.t === "m") {
    const w = POSTER.w * esc, h = POSTER.h * esc;
    const im = n.p ? imgs.obtener(n.p, 154) : null;
    ctx.beginPath();
    ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, 6 * esc);
    if (im) { ctx.save(); ctx.clip(); ctx.drawImage(im, p.x - w / 2, p.y - h / 2, w, h); ctx.restore(); }
    else { ctx.fillStyle = "#1a1a22"; ctx.fill(); }
    ctx.strokeStyle = n.v ? COLOR_NODO.vista : "#33333d";
    ctx.lineWidth = esFoco ? 2.5 : 1.5;
    ctx.stroke();
    if (n.v) { ctx.fillStyle = COLOR_NODO.vista; ctx.beginPath(); ctx.arc(p.x + w / 2 - 5, p.y - h / 2 + 5, 3.5, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const r = RADIO_PERSONA * esc;
    const im = n.f ? imgs.obtener(n.f, 92) : null;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (im) { ctx.save(); ctx.clip(); ctx.drawImage(im, p.x - r, p.y - r, r * 2, r * 2); ctx.restore(); }
    else {
      ctx.fillStyle = "#1a1a22"; ctx.fill();
      ctx.fillStyle = colorDe(n); ctx.font = `${16 * esc}px ${FUENTE}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(n.l.charAt(0), p.x, p.y);
      ctx.textBaseline = "alphabetic";
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = colorDe(n);
    ctx.lineWidth = esFoco ? 3 : 1.8;
    ctx.stroke();
  }
  if (!esFoco) etiqueta(ctx, n, { ...p, escala: esc }, esHover);
  ctx.restore();
}

// Modo explorar: aristas radiales, vecinos y el foco encima.
export function dibujarRueda(ctx: CanvasRenderingContext2D, nodes: readonly Nodo[], foco: number, pos: ReadonlyMap<number, Pos>, hover: number | null, imgs: CacheImagenes) {
  const c = pos.get(foco);
  if (!c) return;
  ctx.lineWidth = 1.2;
  for (const [i, p] of pos) {
    if (i === foco) continue;
    ctx.strokeStyle = nodes[i].v ? "rgba(240,180,41,0.35)" : "rgba(120,120,135,0.22)";
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  for (const [i, p] of pos) if (i !== foco) nodoRueda(ctx, nodes[i], p, false, i === hover, imgs);
  nodoRueda(ctx, nodes[foco], c, true, false, imgs);
}

// Modo vista global: todas las aristas en un solo trazo (miles de stroke() eran el cuello
// de botella) y los nodos como puntos; etiquetas solo al acercarse o al pasar por encima.
export function dibujarGlobal(ctx: CanvasRenderingContext2D, nodes: readonly Nodo[], links: readonly (readonly [number, number])[], cam: Camara, W: number, H: number, hover: number | null) {
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "rgba(120,120,135,0.09)";
  ctx.beginPath();
  for (const [u, v] of links) {
    const [x1, y1] = aPantalla(cam, W, H, nodes[u].x, nodes[u].y);
    const [x2, y2] = aPantalla(cam, W, H, nodes[v].x, nodes[v].y);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.font = `11px ${FUENTE}`;
  ctx.textAlign = "left";
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const [x, y] = aPantalla(cam, W, H, n.x, n.y);
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue; // fuera de pantalla
    const r = (n.t === "m" ? 2.3 : 2 + Math.min(n.v, 8) * 0.5) * (i === hover ? 2 : 1);
    ctx.fillStyle = colorDe(n);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (i === hover || (cam.k > 2.4 && n.v > 2)) { ctx.fillStyle = COLOR.ivory; ctx.fillText(n.l, x + 7, y + 3.5); }
  }
}
