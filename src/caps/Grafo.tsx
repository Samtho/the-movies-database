import { useCallback, useMemo, useState } from "react";
import { Buscador } from "../components/Buscador";
import { Chip } from "../components/Chip";
import { EstadoCarga } from "../components/EstadoCarga";
import { COLOR_NODO, colorDe } from "../components/grafo/dibujo";
import { LienzoGrafo } from "../components/grafo/LienzoGrafo";
import { Avatar, Poster } from "../components/Poster";
import { Bloque, Item } from "../components/ui";
import { formatoNumero } from "../lib/format";
import { caminoMasCorto, gradosDeSeparacion } from "../lib/grafo/camino";
import { buscarNodos, construirAdyacencia, focoInicial, rolDe, vecinosOrdenados, vistasDePersona } from "../lib/grafo/estructura";
import type { Nodo } from "../lib/schema";
import { useDatos } from "../lib/useDatos";

type Modo = "explorar" | "camino" | "global";
const MODOS: [Modo, string][] = [["explorar", "Explorar"], ["camino", "Grados de separación"], ["global", "Vista global"]];
const LARGO_RASTRO = 8;

// Grafo 2.0, patrón Obsidian: nunca la maraña entera, sino el GRAFO LOCAL
// (un foco + sus vecinos en rueda) que se expande al hacer clic. El camino
// de grados de separación se muestra como cadena legible (patrón Oracle of Bacon).
export default function Grafo({ onFicha }: { onFicha: (id: number) => void }) {
  const r = useDatos(["grafo"] as const);
  const g = r.estado === "listo" ? r.datos[0] : null;
  const ady = useMemo(() => (g ? construirAdyacencia(g.nodes.length, g.links) : []), [g]);
  const [modo, setModo] = useState<Modo>("explorar");

  // explorar
  const [focoElegido, setFoco] = useState<number | null>(null);
  const [rastro, setRastro] = useState<number[]>([]);
  const foco = focoElegido ?? (g ? focoInicial(g.nodes) : null);
  const vecinos = useMemo(() => (g && foco != null ? vecinosOrdenados(ady, g.nodes, foco) : []), [g, ady, foco]);
  const irA = useCallback((i: number) => {
    if (foco != null && i !== foco) setRastro((t) => [...t.slice(-(LARGO_RASTRO - 1)), foco]);
    setFoco(i);
    setModo("explorar");
  }, [foco]);

  // grados de separación
  const [qA, setQA] = useState(""), [qB, setQB] = useState("");
  const [pA, setPA] = useState<number | null>(null), [pB, setPB] = useState<number | null>(null);
  const camino = useMemo(() => (pA != null && pB != null ? caminoMasCorto(ady, pA, pB) : null), [ady, pA, pB]);

  if (!g) {
    return <Bloque kicker="Capítulo 3 · el grafo"><EstadoCarga estado={r} texto="Cargando el grafo…" onReintentar={r.reintentar} /></Bloque>;
  }
  const buscar = (q: string) => buscarNodos(g.nodes, q);
  const nf = foco != null ? g.nodes[foco] : null;
  const vistasFoco = foco != null ? vistasDePersona(ady, g.nodes, foco) : null;
  const renderResultado = ({ n }: { n: Nodo }) => (
    <><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: colorDe(n) }} />
      {n.l}{n.t === "m" ? ` (${n.a})` : ""} <span className="text-faint">· {rolDe(n)}</span></>
  );
  // al escribir en un buscador de camino, el extremo elegido deja de valer
  const cambiarA = (v: string) => { setQA(v); setPA(null); };
  const cambiarB = (v: string) => { setQB(v); setPB(null); };

  return (
    <Bloque kicker="Capítulo 3 · el grafo"
      titulo={<>Todo el cine está <span className="text-marquee">conectado</span>.</>}
      intro="Al estilo Obsidian: en vez de la maraña completa, un foco y su rueda de conexiones. Haz clic en cualquier nodo para viajar; usa Grados de separación para medir la distancia entre dos nombres.">
      <Item className="mt-6 flex flex-wrap items-center gap-2">
        {MODOS.map(([m, l]) => <Chip key={m} activo={modo === m} onClick={() => setModo(m)}>{l}</Chip>)}
        {modo === "explorar" && (
          <Buscador placeholder="Buscar película o persona…" buscar={buscar} claveDe={(x) => x.i} render={renderResultado} onElegir={(x) => irA(x.i)} />
        )}
      </Item>

      {modo === "explorar" && nf && (
        <Item className="mt-4 flex flex-wrap items-center gap-3">
          {rastro.length > 0 && (
            <nav aria-label="Recorrido" className="flex items-center gap-1.5 text-xs text-faint">
              {rastro.slice(-4).map((i, j) => (
                <button type="button" key={`${i}-${j}`} onClick={() => irA(i)} className="hover:text-marquee underline decoration-hairline">{g.nodes[i].l}</button>
              ))}
              <span aria-hidden="true">→</span>
            </nav>
          )}
          <span className="font-display text-2xl font-semibold">{nf.l}</span>
          <span className="text-xs text-faint">{rolDe(nf)}{nf.t === "m" ? ` · ${nf.a}` : ""}</span>
          {vistasFoco && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-marquee/15 text-marquee border border-marquee/40 font-bold">
              has visto {formatoNumero(vistasFoco.vistas)} de sus {formatoNumero(vistasFoco.total)}
            </span>
          )}
          {nf.t === "m" && (
            <button type="button" onClick={() => onFicha(nf.id)} className="text-xs px-3 py-1.5 rounded-full bg-marquee text-stage font-bold hover:brightness-110">Abrir ficha →</button>
          )}
        </Item>
      )}

      {modo === "camino" && (
        <>
          <Item className="mt-4 grid md:grid-cols-2 gap-3 max-w-3xl">
            <Buscador placeholder="De… (ej. Leonardo DiCaprio)" valor={qA} onValor={cambiarA} limpiarAlElegir={false}
              buscar={(q) => (pA == null ? buscar(q) : [])} claveDe={(x) => x.i} render={renderResultado}
              onElegir={(x) => { setPA(x.i); setQA(x.n.l); }} />
            <Buscador placeholder="a… (ej. James Cameron)" valor={qB} onValor={cambiarB} limpiarAlElegir={false}
              buscar={(q) => (pB == null ? buscar(q) : [])} claveDe={(x) => x.i} render={renderResultado}
              onElegir={(x) => { setPB(x.i); setQB(x.n.l); }} />
          </Item>
          {pA != null && pB != null && pA === pB && (
            <Item className="mt-4 text-sm text-faint">Es el mismo nombre en los dos lados: 0 grados de separación.</Item>
          )}
          {camino && camino.length > 1 && (
            <Item className="mt-6 rounded-2xl border border-marquee/40 bg-marquee/5 p-6">
              <p className="kicker kicker-sm mb-4">
                {gradosDeSeparacion(camino)} {gradosDeSeparacion(camino) === 1 ? "grado" : "grados"} de separación
              </p>
              <ol className="flex flex-wrap items-start gap-x-2 gap-y-4">
                {camino.map((i, j) => (
                  <li key={`${i}-${j}`} className="flex items-start gap-2">
                    <NodoChip n={g.nodes[i]} onClick={() => irA(i)} />
                    {j < camino.length - 1 && <span aria-hidden="true" className="text-marquee text-2xl mt-8">→</span>}
                  </li>
                ))}
              </ol>
            </Item>
          )}
          {pA != null && pB != null && !camino && <Item className="mt-4 text-sm text-blood">Sin conexión dentro de esta red.</Item>}
        </>
      )}

      {(modo === "explorar" || modo === "global") && (
        <Item className="relative mt-5 rounded-2xl border border-hairline overflow-hidden">
          <LienzoGrafo nodes={g.nodes} links={g.links} modo={modo} foco={foco} vecinos={vecinos} onElegir={irA} onAbrirFicha={onFicha} />
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint pointer-events-none">
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR_NODO.vista }} />vista</span>
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR_NODO.pelicula }} />película</span>
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR_NODO.direccion }} />dirección</span>
            <span><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: COLOR_NODO.reparto }} />reparto</span>
            <span className="hidden md:inline">{modo === "explorar" ? "· clic en un nodo = viajar · clic en el centro (película) = ficha" : "· rueda o pellizco = zoom · arrastra = mover · clic = explorar ese nodo"}</span>
          </div>
        </Item>
      )}
    </Bloque>
  );
}

function NodoChip({ n, onClick }: { n: Nodo; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 group w-24">
      {n.t === "m" ? (
        <span className="relative w-16 h-24 rounded-lg overflow-hidden border border-hairline group-hover:border-marquee bg-stage">
          <Poster ruta={n.p} alt="" className="w-full h-full object-cover" />
          {n.v === 1 && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-marquee" aria-label="vista" />}
        </span>
      ) : (
        <Avatar ruta={n.f} nombre={n.l} tamano="w-16 h-16" className="text-xl border-2 group-hover:border-marquee" />
      )}
      <span className="text-[11px] leading-tight text-center text-ivory-dim group-hover:text-marquee">{n.l}</span>
    </button>
  );
}
