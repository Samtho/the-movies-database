import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { carga, poster, type Ficha } from "./lib/data";

type Vistas = Record<string, { d: string; n: number }>;
const fFecha = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

// Ficha de persona: su filmografía en esta base, con TU historial encima
// (qué has visto de ella y cuándo). Clic en una película -> su ficha.
export default function PersonaModal({ nombre, onClose, onPeli }: {
  nombre: string | null; onClose: () => void; onPeli: (id: number) => void;
}) {
  const [fichas, setFichas] = useState<Record<string, Ficha> | null>(null);
  const [vistas, setVistas] = useState<Vistas | null>(null);
  useEffect(() => {
    carga<Record<string, Ficha>>("fichas").then(setFichas);
    carga<Vistas>("vistas").then(setVistas);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = useMemo(() => {
    if (!nombre || !fichas) return null;
    const pelis: { id: number; f: Ficha; rol: string }[] = [];
    let foto: string | null = null;
    for (const [id, f] of Object.entries(fichas)) {
      if (f.d === nombre) { pelis.push({ id: +id, f, rol: "dirige" }); if (!foto && f.dp) foto = f.dp; }
      else {
        const i = f.c?.indexOf(nombre) ?? -1;
        if (i >= 0) { pelis.push({ id: +id, f, rol: "actúa" }); if (!foto && f.cp?.[i]) foto = f.cp[i]; }
      }
    }
    pelis.sort((a, b) => (b.f.v - a.f.v) || (b.f.a - a.f.a));
    return { pelis, foto };
  }, [nombre, fichas]);

  const vistasDe = info?.pelis.filter((p) => p.f.v === 1) ?? [];
  return (
    <AnimatePresence>
      {nombre != null && (
        <motion.div className="fixed inset-0 z-[97] bg-stage/92 backdrop-blur-md overflow-y-auto no-scrollbar"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="max-w-5xl mx-auto my-8 md:my-14 rounded-3xl border border-hairline bg-stage-soft p-6 md:p-10 marquee-glow"
            initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-5">
                {poster(info?.foto ?? null, 342)
                  ? <img src={poster(info?.foto ?? null, 342)!} alt={nombre} className="h-24 w-24 md:h-32 md:w-32 rounded-full object-cover border-2 border-marquee/50 shadow-2xl" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <span className="h-24 w-24 md:h-32 md:w-32 rounded-full bg-stage grid place-items-center text-3xl text-faint border border-hairline">{nombre[0]}</span>}
                <div>
                  <h3 className="font-display font-semibold leading-tight" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.8rem)" }}>{nombre}</h3>
                  {info && (
                    <p className="text-[15px] text-ivory-dim mt-1.5">
                      Has visto <strong className="text-marquee">{vistasDe.length}</strong> de sus {info.pelis.length} películas en esta base
                      {vistasDe.length > 0 && vistas && (() => {
                        const conFecha = vistasDe.map((p) => vistas[String(p.id)]?.d).filter(Boolean).sort();
                        return conFecha.length ? <> · la última el {fFecha(conFecha[conFecha.length - 1])}</> : null;
                      })()}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="text-faint hover:text-marquee text-3xl leading-none">×</button>
            </div>
            {info && (
              <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {info.pelis.slice(0, 30).map((p) => {
                  const v = vistas?.[String(p.id)];
                  return (
                    <button key={p.id} onClick={() => onPeli(p.id)} className="group text-left">
                      <div className="relative rounded-xl overflow-hidden border border-hairline group-hover:border-marquee transition-colors aspect-[2/3] bg-stage">
                        {poster(p.f.p, 154)
                          ? <img src={poster(p.f.p, 154)!} alt={p.f.t} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          : null}
                        <span className="absolute inset-x-1 bottom-1 text-[9px] text-faint truncate pointer-events-none">{p.f.t}</span>
                        {p.f.v === 1 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-leaf shadow" />}
                        {p.rol === "dirige" && <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-blood/90 text-ivory rounded px-1 py-0.5">DIR</span>}
                      </div>
                      <div className="mt-1.5 text-xs font-medium leading-tight truncate">{p.f.t}</div>
                      <div className="text-[11px] text-faint">
                        {p.f.a}{v ? <span className="text-leaf"> · vista {fFecha(v.d)}</span> : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {info && info.pelis.length > 30 && <p className="mt-4 text-xs text-faint">Mostrando 30 de {info.pelis.length} (primero las vistas, luego por año).</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
