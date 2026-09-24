import { useCallback, useEffect, useRef } from "react";
import { arrastrar, CAMARA_INICIAL, nodoEnGlobal, zoomEn, type Camara } from "../../lib/grafo/camara";
import { interpolar, layoutRueda, nodoEnRueda, type Pos } from "../../lib/grafo/rueda";
import type { Nodo } from "../../lib/schema";
import { CacheImagenes, dibujarGlobal, dibujarRueda } from "./dibujo";

export type ModoLienzo = "explorar" | "global";

const DURACION_TRANSICION = 380; // ms del viaje entre focos
const UMBRAL_CLIC = 5; // px: menos movimiento que esto entre bajar y subir el puntero es un clic
const ZOOM_RUEDA = 1.12;

type Props = {
  nodes: readonly Nodo[];
  links: readonly (readonly [number, number])[];
  modo: ModoLienzo;
  foco: number | null;
  vecinos: readonly number[];
  onElegir: (i: number) => void; // viajar a un nodo (en global, además pasa a explorar)
  onAbrirFicha: (tmdbId: number) => void;
};

// Lienzo del grafo. React decide QUÉ se ve (modo, foco, vecinos); este componente decide
// CÓMO y CUÁNDO se pinta, fuera del ciclo de render de React:
// - el tamaño solo cambia cuando cambia el contenedor (ResizeObserver),
// - el hover vive en un ref (moverse sobre el lienzo no re-renderiza React),
// - se pinta como mucho una vez por fotograma (requestAnimationFrame),
// - respeta la densidad de píxeles (nítido en pantallas Retina),
// - admite ratón, táctil (arrastrar y pellizcar) y rueda sin desplazar la página.
export function LienzoGrafo({ nodes, links, modo, foco, vecinos, onElegir, onAbrirFicha }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tam = useRef({ w: 0, h: 0, dpr: 1 });
  const hover = useRef<number | null>(null);
  const camara = useRef<Camara>(CAMARA_INICIAL);
  const anim = useRef({ t0: 0, desde: new Map<number, Pos>(), actual: new Map<number, Pos>() });
  const frame = useRef<number | null>(null);
  const props = useRef({ nodes, links, modo, foco, vecinos, onElegir, onAbrirFicha });
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef({ x0: 0, y0: 0, movido: 0, distancia: 0 });
  const pintar = useRef<() => void>(() => {});
  const imgs = useRef<CacheImagenes | null>(null);

  const pedirDibujo = useCallback(() => {
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; pintar.current(); });
  }, []);

  // Pinta el estado actual. Vive en un ref para leer siempre las props más recientes.
  useEffect(() => {
    pintar.current = () => {
      const cv = canvas.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      imgs.current ??= new CacheImagenes(pedirDibujo);
      const { w, h, dpr } = tam.current;
      const p = props.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (p.modo === "explorar" && p.foco != null) {
        const objetivo = layoutRueda(w, h, p.foco, p.vecinos);
        const t = (performance.now() - anim.current.t0) / DURACION_TRANSICION;
        const origen: Pos = { x: w / 2, y: h / 2, escala: 0.2 };
        const actual = new Map<number, Pos>();
        for (const [i, dest] of objetivo) actual.set(i, interpolar(anim.current.desde.get(i), dest, t, origen));
        anim.current.actual = actual;
        dibujarRueda(ctx, p.nodes, p.foco, actual, hover.current, imgs.current);
        if (t < 1) pedirDibujo();
      } else if (p.modo === "global") {
        dibujarGlobal(ctx, p.nodes, p.links, camara.current, w, h, hover.current);
      }
    };
  }, [pedirDibujo]);

  // Nuevas props: se guardan y se repinta.
  useEffect(() => {
    props.current = { nodes, links, modo, foco, vecinos, onElegir, onAbrirFicha };
    pedirDibujo();
  }, [nodes, links, modo, foco, vecinos, onElegir, onAbrirFicha, pedirDibujo]);

  // Cambio de foco o de modo: la transición arranca desde lo que hay en pantalla.
  useEffect(() => {
    anim.current.desde = anim.current.actual;
    anim.current.t0 = performance.now();
    hover.current = null;
    pedirDibujo();
  }, [foco, modo, pedirDibujo]);

  // Tamaño y densidad de píxeles: solo cuando cambia el contenedor.
  useEffect(() => {
    const cv = canvas.current, wr = wrap.current;
    if (!cv || !wr) return;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wr.clientWidth, h = wr.clientHeight;
      tam.current = { w, h, dpr };
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      pintar.current();
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(wr);
    return () => {
      ro.disconnect();
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, []);

  // Rueda del ratón: zoom en la vista global sin desplazar la página. Listener nativo
  // no pasivo: el onWheel de React es pasivo y no puede cancelar el scroll.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      if (props.current.modo !== "global") return;
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const { w, h } = tam.current;
      camara.current = zoomEn(camara.current, e.deltaY < 0 ? ZOOM_RUEDA : 1 / ZOOM_RUEDA, w, h, e.clientX - r.left, e.clientY - r.top);
      pedirDibujo();
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [pedirDibujo]);

  const nodoEn = (x: number, y: number): number | null => {
    const p = props.current;
    if (p.modo === "explorar") return nodoEnRueda(anim.current.actual, p.nodes, x, y);
    return nodoEnGlobal(p.nodes, camara.current, tam.current.w, tam.current.h, x, y);
  };

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    punteros.current.set(e.pointerId, p);
    if (punteros.current.size === 1) gesto.current = { x0: p.x, y0: p.y, movido: 0, distancia: 0 };
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      gesto.current.distancia = Math.hypot(a.x - b.x, a.y - b.y);
      gesto.current.movido = Number.POSITIVE_INFINITY; // un pellizco nunca es un clic
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    const previo = punteros.current.get(e.pointerId);
    const { modo: m } = props.current;
    if (previo && m === "global") {
      punteros.current.set(e.pointerId, p);
      if (punteros.current.size === 1) {
        camara.current = arrastrar(camara.current, p.x - previo.x, p.y - previo.y);
        gesto.current.movido += Math.abs(p.x - previo.x) + Math.abs(p.y - previo.y);
      } else if (punteros.current.size === 2) {
        const [a, b] = [...punteros.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (gesto.current.distancia > 0 && d > 0) {
          const { w, h } = tam.current;
          camara.current = zoomEn(camara.current, d / gesto.current.distancia, w, h, (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        gesto.current.distancia = d;
      }
      pedirDibujo();
      return;
    }
    if (previo) {
      punteros.current.set(e.pointerId, p);
      gesto.current.movido += Math.abs(p.x - previo.x) + Math.abs(p.y - previo.y);
    }
    const i = nodoEn(p.x, p.y);
    if (i !== hover.current) {
      hover.current = i;
      e.currentTarget.style.cursor = m === "global" ? "grab" : i != null ? "pointer" : "default";
      pedirDibujo();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const eraUnico = punteros.current.size === 1;
    punteros.current.delete(e.pointerId);
    if (!eraUnico || gesto.current.movido >= UMBRAL_CLIC) return;
    const p = local(e);
    const i = nodoEn(p.x, p.y);
    if (i == null) return;
    const actual = props.current;
    const n = actual.nodes[i];
    if (actual.modo === "explorar" && i === actual.foco) {
      if (n.t === "m") actual.onAbrirFicha(n.id);
    } else {
      actual.onElegir(i);
    }
  };

  const onPointerLeave = () => {
    if (hover.current != null) { hover.current = null; pedirDibujo(); }
  };

  return (
    <div ref={wrap} style={{ height: "68vh", background: "radial-gradient(90% 90% at 50% 42%, #101017 0%, #0a0a0d 100%)" }}>
      <canvas ref={canvas} role="img"
        aria-label={modo === "global" ? "Vista global del grafo de películas y personas" : "Grafo local: el foco en el centro y sus conexiones alrededor"}
        style={{ touchAction: modo === "global" ? "none" : "manipulation", display: "block" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={(e) => punteros.current.delete(e.pointerId)} onPointerLeave={onPointerLeave} />
    </div>
  );
}
