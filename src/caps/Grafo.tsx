import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { carga, poster } from "../lib/data";
import { Bloque, Item } from "../lib/ui";

// Grafo 2.0, patrón Obsidian: nunca la maraña entera, sino el GRAFO LOCAL
// (un foco + sus vecinos en rueda) que se expande al hacer clic. El camino
// de grados de separación se muestra como cadena legible (patrón Oracle of Bacon).
type Nodo = { t: "m" | "d" | "a"; id?: number; l: string; a?: number; v: number; p?: string | null; f?: string | null; x: number; y: number };
type GrafoData = { nodes: Nodo[]; links: [number, number][] };
type Modo = "explorar" | "camino" | "global";

const COLOR = { m_v: "#f0b429", m: "#4a4a55", d: "#e0563f", a: "#58c99a" };
const colorDe = (n: Nodo) => (n.t === "m" ? (n.v ? COLOR.m_v : COLOR.m) : n.t === "d" ? COLOR.d : COLOR.a);
const rolDe = (n: Nodo) => (n.t === "m" ? "película" : n.t === "d" ? "director/a" : "actor/actriz");

export default function Grafo({ onFicha }: { onFicha: (id: number) => void }) {
  const [g, setG] = useState<GrafoData | null>(null);
  const [modo, setModo] = useState<Modo>("explorar");
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => { carga<GrafoData>("grafo").then(setG); }, []);
  const ady = useMemo(() => {
    if (!g) return [] as number[][];
    const a: number[][] = g.nodes.map(() => []);
    for (const [u, v] of g.links) { a[u].push(v); a[v].push(u); }
    return a;
  }, [g]);

  // ---------- imágenes (cache + redibujo al cargar) ----------
  const imgs = useRef<Map<string, HTMLImageElement | "x">>(new Map());
  const redraw = useRef<() => void>(() => {});
  const img = (path: string, w: 92 | 154 = 92): HTMLImageElement | null => {
    const key = `${w}${path}`;
    const c = imgs.current.get(key);
    if (c && c !== "x") return c;
    if (!c) {
      const im = new Image();
      im.onload = () => { imgs.current.set(key, im); redraw.current(); };
      im.onerror = () => { imgs.current.set(key, "x"); };
      im.src = `https://image.tmdb.org/t/p/w${w}${path}`;
      imgs.current.set(key, "x");
      imgs.current.set(key, "x"); // marcado; onload lo sustituye
    }
    return null;
  };

  // ---------- estado del modo explorar ----------
  const [focus, setFocus] = useState<number | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const anim = useRef<{ t0: number; from: Map<number, [number, number, number]>; to: Map<number, [number, number, number]> }>({ t0: 0, from: new Map(), to: new Map() });

  // foco inicial: tu persona más vista
  useEffect(() => {
    if (!g || focus != null) return;
    let best = -1, bv = -1;
    g.nodes.forEach((n, i) => { if (n.t !== "m" && n.v > bv) { bv = n.v; best = i; } });
    setFocus(best >= 0 ? best : 0);
  }, [g, focus]);

  // vecinos del foco, ordenados y limitados
  const rueda = useMemo(() => {
    if (!g || focus == null) return [];
    const ns = ady[focus] ?? [];
    const orden = [...ns].sort((a, b) => {
      const na = g.nodes[a], nb = g.nodes[b];
      return (nb.v - na.v) || ((nb.a ?? 0) - (na.a ?? 0));
    });
    return orden.slice(0, 18);
  }, [g, focus, ady]);

  // layout objetivo de la rueda (foco centro, vecinos en círculo)
  const layout = useCallback((W: number, H: number) => {
    const to = new Map<number, [number, number, number]>(); // x,y,escala
    if (focus == null) return to;
    to.set(focus, [W / 2, H / 2 - 8, 1.6]);
    const R = Math.min(W, H) * 0.345;
    rueda.forEach((ni, i) => {
      const a = -Math.PI / 2 + (i / rueda.length) * Math.PI * 2;
      to.set(ni, [W / 2 + Math.cos(a) * R, H / 2 - 8 + Math.sin(a) * R, 1]);
    });
    return to;
  }, [focus, rueda]);

  const irA = (i: number) => {
    if (focus != null && i !== focus) setTrail((t) => [...t.slice(-7), focus]);
    setFocus(i); setHover(null);
  };

  // ---------- estado del modo camino ----------
  const [qA, setQA] = useState(""); const [qB, setQB] = useState("");
  const [pA, setPA] = useState<number | null>(null); const [pB, setPB] = useState<number | null>(null);
  const camino = useMemo(() => {
    if (!g || pA == null || pB == null) return null;
    const prev = new Int32Array(g.nodes.length).fill(-2); prev[pA] = -1;
    const q = [pA];
    while (q.length) {
      const u = q.shift()!;
      if (u === pB) break;
      for (const v of ady[u]) if (prev[v] === -2) { prev[v] = u; q.push(v); }
    }
    if (prev[pB] === -2) return null;
    const path = [pB]; let cur = pB;
    while (prev[cur] >= 0) { cur = prev[cur]; path.push(cur); }
    return path.reverse();
  }, [g, pA, pB, ady]);

  const buscar = (q: string) => {
    if (!g || q.length < 2) return [];
    const lq = q.toLowerCase();
    return g.nodes.map((n, i) => ({ n, i })).filter((x) => x.n.l.toLowerCase().includes(lq))
      .sort((a, b) => b.n.v - a.n.v).slice(0, 6);
  };

  // ---------- estado del modo global ----------
  const view = useRef({ x: 0, y: 0, k: 0.55 });
  const drag = useRef({ on: false, x: 0, y: 0 });

  // ---------- dibujo ----------
  const dibujar = useCallback(() => {
    const cv = canvas.current; if (!cv || !g) return;
    const ctx = cv.getContext("2d")!;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    if (modo === "explorar" && focus != null) {
      const objetivo = layout(W, H);
      // interpolación suave hacia el objetivo
      const t = Math.min(1, (performance.now() - anim.current.t0) / 380);
      const ease = 1 - Math.pow(1 - t, 3);
      const pos = new Map<number, [number, number, number]>();
      for (const [i, dest] of objetivo) {
        const from = anim.current.from.get(i) ?? [W / 2, H / 2, 0.2];
        pos.set(i, [from[0] + (dest[0] - from[0]) * ease, from[1] + (dest[1] - from[1]) * ease, from[2] + (dest[2] - from[2]) * ease]);
      }
      anim.current.to = objetivo;
      // aristas radiales
      for (const ni of rueda) {
        const a = pos.get(ni)!, c = pos.get(focus)!;
        ctx.strokeStyle = g.nodes[ni].v ? "rgba(240,180,41,0.35)" : "rgba(120,120,135,0.22)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(a[0], a[1]); ctx.stroke();
      }
      // nodos
      const dibujaNodo = (i: number) => {
        const p = pos.get(i); if (!p) return;
        const n = g.nodes[i];
        const esFoco = i === focus, esHover = i === hover;
        const esc = p[2] * (esHover && !esFoco ? 1.14 : 1);
        ctx.save();
        if (n.t === "m") {
          const w = 46 * esc, h = 69 * esc;
          const im = n.p ? img(n.p, 154) : null;
          ctx.beginPath(); ctx.roundRect(p[0] - w / 2, p[1] - h / 2, w, h, 6 * esc);
          if (im) { ctx.save(); ctx.clip(); ctx.drawImage(im, p[0] - w / 2, p[1] - h / 2, w, h); ctx.restore(); }
          else { ctx.fillStyle = "#1a1a22"; ctx.fill(); }
          ctx.strokeStyle = n.v ? COLOR.m_v : "#33333d"; ctx.lineWidth = esFoco ? 2.5 : 1.5; ctx.stroke();
          if (n.v) { ctx.fillStyle = COLOR.m_v; ctx.beginPath(); ctx.arc(p[0] + w / 2 - 5, p[1] - h / 2 + 5, 3.5, 0, 7); ctx.fill(); }
        } else {
          const r = 26 * esc;
          const im = n.f ? img(n.f, 92) : null;
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
          if (im) { ctx.save(); ctx.clip(); ctx.drawImage(im, p[0] - r, p[1] - r, r * 2, r * 2); ctx.restore(); }
          else { ctx.fillStyle = "#1a1a22"; ctx.fill(); ctx.fillStyle = colorDe(n); ctx.font = `${16 * esc}px Archivo`; ctx.textAlign = "center"; ctx.fillText(n.l[0], p[0], p[1] + 5); }
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
          ctx.strokeStyle = colorDe(n); ctx.lineWidth = esFoco ? 3 : 1.8; ctx.stroke();
        }
        // etiqueta
        if (!esFoco) {
          ctx.fillStyle = esHover ? "#f2ede1" : "#b6b0a2"; ctx.font = "11.5px Archivo"; ctx.textAlign = "center";
          const l = n.l.length > 20 ? n.l.slice(0, 19) + "…" : n.l;
          ctx.fillText(l, p[0], p[1] + (n.t === "m" ? 69 * esc / 2 : 26 * esc) + 15);
          if (n.a) { ctx.fillStyle = "#6e695e"; ctx.font = "10px Archivo"; ctx.fillText(String(n.a), p[0], p[1] + (n.t === "m" ? 69 * esc / 2 : 26 * esc) + 28); }
        }
        ctx.restore();
      };
      for (const ni of rueda) dibujaNodo(ni);
      dibujaNodo(focus);
      if (t < 1) requestAnimationFrame(() => redraw.current());
    }

    if (modo === "global") {
      const { x: ox, y: oy, k } = view.current;
      const sx = (x: number) => W / 2 + (x - ox) * k, sy = (y: number) => H / 2 + (y - oy) * k;
      ctx.lineWidth = 0.5; ctx.strokeStyle = "rgba(120,120,135,0.09)";
      for (const [u, v] of g.links) {
        ctx.beginPath(); ctx.moveTo(sx(g.nodes[u].x), sy(g.nodes[u].y)); ctx.lineTo(sx(g.nodes[v].x), sy(g.nodes[v].y)); ctx.stroke();
      }
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i];
        const r = (n.t === "m" ? 2.3 : 2 + Math.min(n.v, 8) * 0.5) * (i === hover ? 2 : 1);
        ctx.fillStyle = colorDe(n);
        ctx.beginPath(); ctx.arc(sx(n.x), sy(n.y), r, 0, Math.PI * 2); ctx.fill();
        if (i === hover || (k > 2.4 && n.v > 2)) {
          ctx.fillStyle = "#f2ede1"; ctx.font = "11px Archivo"; ctx.textAlign = "left";
          ctx.fillText(n.l, sx(n.x) + 7, sy(n.y) + 3.5);
        }
      }
    }
  }, [g, modo, focus, rueda, hover, layout]);

  useEffect(() => { redraw.current = dibujar; dibujar(); }, [dibujar]);
  // al cambiar el foco: arrancar animación desde las posiciones actuales
  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    anim.current.from = anim.current.to.size ? anim.current.to : new Map();
    anim.current.t0 = performance.now();
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, modo]);
  useEffect(() => {
    const cv = canvas.current, wr = wrap.current; if (!cv || !wr) return;
    const fit = () => { cv.width = wr.clientWidth; cv.height = wr.clientHeight; dibujar(); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(wr);
    return () => ro.disconnect();
  }, [dibujar]);

  // hit-test según el modo
  const nodoEn = (mx: number, my: number): number | null => {
    const cv = canvas.current; if (!cv || !g) return null;
    if (modo === "explorar" && focus != null) {
      const objetivo = layout(cv.width, cv.height);
      for (const [i, p] of objetivo) {
        const dx = mx - p[0], dy = my - p[1];
        const rad = g.nodes[i].t === "m" ? 38 * p[2] : 30 * p[2];
        if (dx * dx + dy * dy < rad * rad) return i;
      }
      return null;
    }
    const { x: ox, y: oy, k } = view.current;
    const wx = (mx - cv.width / 2) / k + ox, wy = (my - cv.height / 2) / k + oy;
    let best = -1, bd = (10 / k) ** 2;
    for (let i = 0; i < g.nodes.length; i++) {
      const d = (g.nodes[i].x - wx) ** 2 + (g.nodes[i].y - wy) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best >= 0 ? best : null;
  };

  const nf = g && focus != null ? g.nodes[focus] : null;
  const vistosDeFoco = g && focus != null && nf && nf.t !== "m"
    ? { v: ady[focus].filter((i) => g.nodes[i].v === 1).length, t: ady[focus].length } : null;

  const NodoChip = ({ i }: { i: number }) => {
    const n = g!.nodes[i];
    return (
      <button onClick={() => { setModo("explorar"); irA(i); }}
        className="flex flex-col items-center gap-1.5 group w-24">
        {n.t === "m" ? (
          <span className="relative w-16 h-24 rounded-lg overflow-hidden border border-hairline group-hover:border-marquee bg-stage">
            {n.p && <img src={poster(n.p, 154)!} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            {n.v === 1 && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-marquee" />}
          </span>
        ) : (
          <span className="w-16 h-16 rounded-full overflow-hidden border-2 group-hover:border-marquee grid place-items-center bg-stage text-faint text-xl" style={{ borderColor: colorDe(n) }}>
            {n.f ? <img src={poster(n.f, 92)!} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : n.l[0]}
          </span>
        )}
        <span className="text-[11px] leading-tight text-center text-ivory-dim group-hover:text-marquee">{n.l}</span>
      </button>
    );
  };

  return (
    <Bloque kicker="Capítulo 3 · el grafo"
      titulo={<>Todo el cine está <span className="text-marquee">conectado</span>.</>}
      intro="Al estilo Obsidian: en vez de la maraña completa, un foco y su rueda de conexiones. Haz clic en cualquier nodo para viajar; usa Camino para medir los grados de separación entre dos nombres.">
      <Item className="mt-6 flex flex-wrap items-center gap-2">
        {([["explorar", "Explorar"], ["camino", "Grados de separación"], ["global", "Vista global"]] as [Modo, string][]).map(([m, l]) => (
          <button key={m} onClick={() => setModo(m)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${modo === m ? "bg-marquee text-stage border-marquee" : "border-hairline text-ivory-dim hover:border-marquee"}`}>
            {l}
          </button>
        ))}
        {modo === "explorar" && (
          <BuscadorNodo placeholder="Buscar película o persona…" buscar={buscar} onPick={(i) => irA(i)} />
        )}
      </Item>

      {modo === "explorar" && nf && (
        <Item className="mt-4 flex flex-wrap items-center gap-3">
          {trail.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-faint">
              {trail.slice(-4).map((i) => (
                <button key={`${i}`} onClick={() => irA(i)} className="hover:text-marquee underline decoration-hairline">{g!.nodes[i].l}</button>
              ))}
              <span>→</span>
            </span>
          )}
          <span className="font-display text-2xl font-semibold">{nf.l}</span>
          <span className="text-xs text-faint">{rolDe(nf)}{nf.a ? ` · ${nf.a}` : ""}</span>
          {vistosDeFoco && <span className="text-xs px-2.5 py-1 rounded-full bg-marquee/15 text-marquee border border-marquee/40 font-bold">has visto {vistosDeFoco.v} de sus {vistosDeFoco.t}</span>}
          {nf.t === "m" && nf.id && (
            <button onClick={() => onFicha(nf.id!)} className="text-xs px-3 py-1.5 rounded-full bg-marquee text-stage font-bold hover:brightness-110">Abrir ficha →</button>
          )}
        </Item>
      )}

      {modo === "camino" && g && (
        <>
          <Item className="mt-4 grid md:grid-cols-2 gap-3 max-w-3xl">
            <BuscadorNodo placeholder="De… (ej. Leonardo DiCaprio)" valor={qA} setValor={setQA} buscar={buscar} onPick={(i) => { setPA(i); setQA(g.nodes[i].l); }} activo={pA == null} />
            <BuscadorNodo placeholder="a… (ej. James Cameron)" valor={qB} setValor={setQB} buscar={buscar} onPick={(i) => { setPB(i); setQB(g.nodes[i].l); }} activo={pB == null} />
          </Item>
          {camino && (
            <Item className="mt-6 rounded-2xl border border-marquee/40 bg-marquee/5 p-6">
              <p className="kicker mb-4" style={{ fontSize: 10 }}>{Math.floor(camino.length / 2)} grados de separación</p>
              <div className="flex flex-wrap items-start gap-x-2 gap-y-4">
                {camino.map((i, j) => (
                  <span key={`${i}-${j}`} className="flex items-start gap-2">
                    <NodoChip i={i} />
                    {j < camino.length - 1 && <span className="text-marquee text-2xl mt-8">→</span>}
                  </span>
                ))}
              </div>
            </Item>
          )}
          {pA != null && pB != null && !camino && <Item className="mt-4 text-sm text-blood">Sin conexión dentro de esta red.</Item>}
        </>
      )}

      {(modo === "explorar" || modo === "global") && (
        <Item className="relative mt-5 rounded-2xl border border-hairline overflow-hidden">
          <div ref={wrap} style={{ height: "68vh", background: "radial-gradient(90% 90% at 50% 42%, #101017 0%, #0a0a0d 100%)" }}>
            <canvas ref={canvas}
              className={modo === "global" ? "cursor-grab active:cursor-grabbing" : hover != null ? "cursor-pointer" : "cursor-default"}
              onMouseDown={(e) => { if (modo === "global") drag.current = { on: true, x: e.clientX, y: e.clientY }; }}
              onMouseUp={(e) => {
                const r = canvas.current!.getBoundingClientRect();
                if (modo === "global") {
                  const moved = Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y);
                  drag.current.on = false;
                  if (moved < 5) {
                    const i = nodoEn(e.clientX - r.left, e.clientY - r.top);
                    if (i != null) { setModo("explorar"); irA(i); }
                  }
                } else {
                  const i = nodoEn(e.clientX - r.left, e.clientY - r.top);
                  if (i != null && i !== focus) irA(i);
                  else if (i === focus && nf?.t === "m" && nf.id) onFicha(nf.id);
                }
              }}
              onMouseMove={(e) => {
                const r = canvas.current!.getBoundingClientRect();
                if (modo === "global" && drag.current.on) {
                  view.current.x -= (e.clientX - drag.current.x) / view.current.k;
                  view.current.y -= (e.clientY - drag.current.y) / view.current.k;
                  drag.current.x = e.clientX; drag.current.y = e.clientY; dibujar();
                } else setHover(nodoEn(e.clientX - r.left, e.clientY - r.top));
              }}
              onWheel={(e) => {
                if (modo !== "global") return;
                view.current.k = Math.max(0.15, Math.min(9, view.current.k * (e.deltaY < 0 ? 1.12 : 0.89)));
                dibujar();
              }} />
          </div>
          <div className="absolute bottom-3 left-4 flex gap-4 text-[11px] text-faint pointer-events-none">
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR.m_v }} />vista</span>
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR.m }} />película</span>
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR.d }} />dirección</span>
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR.a }} />reparto</span>
            <span className="hidden md:inline">{modo === "explorar" ? "· clic en un nodo = viajar · clic en el centro (película) = ficha" : "· rueda = zoom · arrastra = mover · clic = explorar ese nodo"}</span>
          </div>
        </Item>
      )}
    </Bloque>
  );
}

// Buscador con desplegable (compartido por explorar y camino).
function BuscadorNodo({ placeholder, buscar, onPick, valor, setValor, activo = true }: {
  placeholder: string;
  buscar: (q: string) => { n: Nodo; i: number }[];
  onPick: (i: number) => void;
  valor?: string; setValor?: (s: string) => void; activo?: boolean;
}) {
  const [interno, setInterno] = useState("");
  const q = valor ?? interno;
  const setQ = setValor ?? setInterno;
  const res = activo ? buscar(q) : [];
  return (
    <div className="relative min-w-[260px] flex-1 max-w-sm">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-hairline bg-stage-soft px-4 py-2.5 text-sm outline-none focus:border-marquee" />
      {res.length > 0 && q.length >= 2 && (
        <div className="absolute z-30 top-full mt-1 w-full rounded-xl border border-hairline bg-stage-soft overflow-hidden shadow-2xl">
          {res.map((r) => (
            <button key={r.i} onClick={() => { onPick(r.i); if (!setValor) setInterno(""); }}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-stage hover:text-marquee">
              <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: colorDe(r.n) }} />
              {r.n.l}{r.n.a ? ` (${r.n.a})` : ""} <span className="text-faint">· {rolDe(r.n)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
