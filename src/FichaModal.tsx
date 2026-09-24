import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { carga, poster, gen_es, type Ficha } from "./lib/data";

type Vistas = Record<string, { d: string; n: number }>;
type Gusto = { candidatos: { id: number; s: number; r?: number[] }[]; leyenda?: string[] };

const fFecha = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// Ficha universal (espíritu Obsidian): todo lo clicable abre esto; las personas
// también son clicables y llevan a su propia ficha con TU historial.
export default function FichaModal({ id, onClose, onOpen, onPersona }: {
  id: number | null; onClose: () => void; onOpen: (id: number) => void; onPersona: (nombre: string) => void;
}) {
  const [fichas, setFichas] = useState<Record<string, Ficha> | null>(null);
  const [sims, setSims] = useState<Record<string, number[]> | null>(null);
  const [gusto, setGusto] = useState<Map<number, { s: number; r: string[] }> | null>(null);
  const [vistas, setVistas] = useState<Vistas | null>(null);

  useEffect(() => {
    carga<Record<string, Ficha>>("fichas").then(setFichas);
    carga<Record<string, number[]>>("similares").then(setSims);
    carga<Vistas>("vistas").then(setVistas);
    carga<Gusto>("gusto").then((g) =>
      setGusto(new Map(g.candidatos.map((c) => [c.id, { s: c.s, r: (c.r ?? []).map((i) => g.leyenda?.[i] ?? "") }]))));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const f = id != null && fichas ? fichas[String(id)] : null;
  const vista = id != null && vistas ? vistas[String(id)] : null;
  const g = id != null ? gusto?.get(id) : null;

  const Persona = ({ nombre, foto, rol }: { nombre: string; foto: string | null | undefined; rol: string }) => (
    <button onClick={() => onPersona(nombre)} className="flex items-center gap-2.5 group text-left">
      {poster(foto ?? null, 92)
        ? <img src={poster(foto ?? null, 92)!} alt={nombre} className="h-12 w-12 rounded-full object-cover border border-hairline group-hover:border-marquee transition-colors" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        : <span className="h-12 w-12 rounded-full bg-stage grid place-items-center text-faint text-sm border border-hairline group-hover:border-marquee">{nombre[0]}</span>}
      <div>
        <div className="text-sm font-semibold leading-tight group-hover:text-marquee transition-colors">{nombre}</div>
        <div className="text-[10px] text-faint uppercase tracking-wide">{rol}</div>
      </div>
    </button>
  );

  return (
    <AnimatePresence>
      {id != null && (
        <motion.div className="fixed inset-0 z-[95] bg-stage/90 backdrop-blur-md overflow-y-auto no-scrollbar"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="max-w-5xl mx-auto my-8 md:my-14 rounded-3xl border border-hairline bg-stage-soft p-6 md:p-10 marquee-glow"
            initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}>
            {!f ? (
              <p className="text-faint text-sm py-10 text-center">{fichas ? "Sin ficha disponible para esta película." : "Cargando…"}</p>
            ) : (
              <div className="flex flex-col md:flex-row gap-8">
                {poster(f.p, 342) && (
                  <img src={poster(f.p, 342)!} alt={f.t}
                    className="w-52 md:w-72 rounded-2xl border border-hairline shadow-2xl self-start"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display font-semibold leading-tight" style={{ fontSize: "clamp(1.9rem, 3.4vw, 3rem)" }}>{f.t}</h3>
                    <button onClick={onClose} className="text-faint hover:text-marquee text-3xl leading-none shrink-0">×</button>
                  </div>
                  <p className="text-[15px] text-ivory-dim mt-2">
                    {f.a} · {f.g.map(gen_es).join(" · ")}{f.rt ? ` · ${f.rt} min` : ""}
                    {f.va ? ` · ★ ${f.va.toLocaleString("es-ES")} (${f.nv.toLocaleString("es-ES")} votos)` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3.5">
                    {vista && (
                      <span className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-leaf/15 text-leaf border border-leaf/40">
                        LA VISTE el {fFecha(vista.d)}{vista.n > 1 ? ` · ${vista.n} veces` : ""}
                      </span>
                    )}
                    {!vista && g && (
                      <span className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-marquee/15 text-marquee border border-marquee/40">
                        AFINIDAD {Math.round(g.s * 100)}%
                      </span>
                    )}
                    {!vista && g?.r.filter(Boolean).map((r) => (
                      <span key={r} className="text-[12px] px-3 py-1.5 rounded-full bg-stage border border-hairline text-ivory-dim">{r}</span>
                    ))}
                  </div>
                  {f.o && <p className="text-[15px] text-ivory-dim mt-4 leading-relaxed">{f.o}</p>}
                  <div className="mt-6 flex flex-wrap gap-x-7 gap-y-4">
                    {f.d && <Persona nombre={f.d} foto={f.dp} rol="Dirección" />}
                    {f.c.map((a, i) => <Persona key={a} nombre={a} foto={f.cp?.[i]} rol="Reparto" />)}
                  </div>
                  {sims?.[String(id)] && fichas && (
                    <div className="mt-7">
                      <p className="kicker mb-3" style={{ fontSize: 10 }}>Si te gustó esta…</p>
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                        {sims[String(id)].filter((s) => fichas[String(s)]).slice(0, 12).map((s) => {
                          const sf = fichas[String(s)];
                          return (
                            <button key={s} onClick={() => onOpen(s)} title={`${sf.t} (${sf.a})`}
                              className="relative rounded-lg overflow-hidden border border-hairline hover:border-marquee transition-colors aspect-[2/3] bg-stage">
                              {poster(sf.p, 154)
                                ? <img src={poster(sf.p, 154)!} alt={sf.t} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                : null}
                              <span className="absolute inset-x-1 bottom-1 text-[9px] text-faint truncate pointer-events-none">{sf.t}</span>
                              {sf.v === 1 && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-leaf shadow" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
