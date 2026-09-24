import { useEffect, useMemo, useState } from "react";
import { carga, poster, gen_es, type Ficha } from "../lib/data";
import { Bloque, Item } from "../lib/ui";

type Gusto = { candidatos: { id: number; s: number; r?: number[] }[]; leyenda?: string[] };

// ¿Qué veo esta noche? El recomendador personal: candidatas NO vistas,
// ordenadas por el modelo de gusto (regresión logística, AUC 0,908).
export default function Noche({ onFicha }: { onFicha: (id: number) => void }) {
  const [fichas, setFichas] = useState<Record<string, Ficha> | null>(null);
  const [gusto, setGusto] = useState<Gusto | null>(null);
  const [genero, setGenero] = useState<string | null>(null);
  const [decada, setDecada] = useState<number | null>(null);
  const [maxMin, setMaxMin] = useState(240);
  const [sorpresa, setSorpresa] = useState<number | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { carga<Record<string, Ficha>>("fichas").then(setFichas); carga<Gusto>("gusto").then(setGusto); }, []);

  const candidatas = useMemo(() => {
    if (!fichas || !gusto) return [];
    return gusto.candidatos
      .map((c) => ({ ...c, f: fichas[String(c.id)] }))
      .filter((c) => c.f)
      .filter((c) => !genero || c.f.g.includes(genero))
      .filter((c) => !decada || Math.floor(c.f.a / 10) * 10 === decada)
      .filter((c) => !c.f.rt || c.f.rt <= maxMin);
  }, [fichas, gusto, genero, decada, maxMin]);

  const resultadosBusqueda = useMemo(() => {
    if (!fichas || q.length < 2) return [];
    const lq = q.toLowerCase();
    return Object.entries(fichas).filter(([, f]) => f.t.toLowerCase().includes(lq)).slice(0, 6);
  }, [fichas, q]);

  const generos = useMemo(() => {
    if (!fichas || !gusto) return [];
    const c = new Map<string, number>();
    for (const { id } of gusto.candidatos) for (const g of fichas[String(id)]?.g ?? []) c.set(g, (c.get(g) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g);
  }, [fichas, gusto]);

  const lista = sorpresa != null ? candidatas.slice(0, 400).filter((c) => c.id === sorpresa) : candidatas.slice(0, 30);
  return (
    <Bloque kicker="Capítulo 4 · ¿qué veo esta noche?"
      titulo={<>{(gusto?.candidatos.length ?? 0).toLocaleString("es-ES")} candidatas. <span className="text-marquee">Ninguna la has visto.</span></>}
      intro="Ordenadas por tu modelo de gusto: qué probabilidad hay de que esta película sea para ti, según todo lo que ya has visto. Filtra por humor del día o pide una sorpresa.">
      <Item className="mt-6 flex flex-wrap items-center gap-2">
        {generos.map((g) => (
          <button key={g} onClick={() => { setGenero(genero === g ? null : g); setSorpresa(null); }}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors ${genero === g ? "bg-marquee text-stage border-marquee font-bold" : "border-hairline text-ivory-dim hover:border-marquee"}`}>
            {gen_es(g)}
          </button>
        ))}
        <select value={decada ?? ""} onChange={(e) => { setDecada(e.target.value ? +e.target.value : null); setSorpresa(null); }}
          className="rounded-full border border-hairline bg-stage-soft px-3 py-1.5 text-xs text-ivory-dim outline-none">
          <option value="">Cualquier década</option>
          {[1960, 1970, 1980, 1990, 2000, 2010].map((d) => <option key={d} value={d}>{d}s</option>)}
        </select>
        <label className="text-xs text-faint flex items-center gap-2 ml-1">
          ≤ <input type="range" min={80} max={240} step={10} value={maxMin} onChange={(e) => setMaxMin(+e.target.value)} className="accent-[#f0b429]" /> {maxMin} min
        </label>
        <button onClick={() => { const top = candidatas.slice(0, 400); if (top.length) setSorpresa(top[Math.floor(Math.random() * top.length)].id); }}
          className="ml-auto px-4 py-1.5 rounded-full text-xs font-bold bg-blood/90 text-ivory hover:bg-blood transition-colors">
          🎲 Sorpréndeme
        </button>
      </Item>
      <Item className="relative mt-4 max-w-md">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="…o busca una película para ver sus parecidas"
          className="w-full rounded-xl border border-hairline bg-stage-soft px-4 py-2.5 text-sm outline-none focus:border-marquee" />
        {resultadosBusqueda.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full rounded-xl border border-hairline bg-stage-soft overflow-hidden">
            {resultadosBusqueda.map(([id, f]) => (
              <button key={id} onClick={() => { onFicha(+id); setQ(""); }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-stage hover:text-marquee">
                {f.t} <span className="text-faint">({f.a}){f.v ? " · vista" : ""}</span>
              </button>
            ))}
          </div>
        )}
      </Item>
      <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {lista.map((c, i) => (
          <Item key={c.id}>
            <button onClick={() => onFicha(c.id)} className="group w-full text-left">
              <div className="relative rounded-xl overflow-hidden border border-hairline group-hover:border-marquee transition-colors aspect-[2/3] bg-stage-soft">
                {poster(c.f.p, 342)
                  ? <img src={poster(c.f.p, 342)!} alt={c.f.t} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <span className="absolute inset-2 text-xs text-faint">{c.f.t}</span>}
                <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-stage/85 text-marquee rounded px-1.5 py-0.5">
                  {sorpresa == null && i < 3 ? ["🥇", "🥈", "🥉"][i] + " " : ""}{Math.round(c.s * 100)}%
                </span>
              </div>
              <div className="mt-2 text-sm font-medium leading-tight truncate">{c.f.t}</div>
              <div className="text-xs text-faint">{c.f.a}{c.f.rt ? ` · ${c.f.rt} min` : ""}</div>
              {(c.r ?? []).length > 0 && (
                <div className="text-[10px] text-marquee/80 truncate" title={(c.r ?? []).map((i) => gusto?.leyenda?.[i]).join(" · ")}>
                  {(c.r ?? []).slice(0, 2).map((i) => gusto?.leyenda?.[i]).filter(Boolean).join(" · ")}
                </div>
              )}
              <div className="mt-1 h-1 rounded-full bg-hairline overflow-hidden">
                <div className="h-full bg-marquee" style={{ width: `${c.s * 100}%` }} />
              </div>
            </button>
          </Item>
        ))}
      </div>
      {sorpresa != null && (
        <Item className="mt-5"><button onClick={() => setSorpresa(null)} className="text-sm text-marquee hover:underline">← volver a la lista completa</button></Item>
      )}
    </Bloque>
  );
}
