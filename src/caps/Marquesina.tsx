import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { carga, poster, type Ficha, type Stats } from "../lib/data";
import { CountUp, rise, stagger } from "../lib/ui";

// Portada: marquesina de cine con muro de pósters reales del historial.
export default function Marquesina({ onFicha, irA }: { onFicha: (id: number) => void; irA: (cap: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [muro, setMuro] = useState<{ id: number; p: string }[]>([]);
  useEffect(() => {
    carga<Stats>("stats").then(setStats);
    Promise.all([carga<Record<string, Ficha>>("fichas"), carga<Stats>("stats")]).then(([fichas, st]) => {
      const ids = [...st.rewatch.map((r) => r.id), ...st.ratings.map((r) => r.id)].filter((x): x is number => !!x);
      const unicos = [...new Set(ids)];
      const con = unicos.map((id) => ({ id, p: fichas[String(id)]?.p })).filter((x): x is { id: number; p: string } => !!x.p);
      setMuro(con.slice(0, 28));
    });
  }, []);
  const horas = stats ? Math.round(stats.minutos / 60) : 0;
  return (
    <motion.section variants={stagger} initial="hidden" animate="show" className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden">
      {/* muro de pósters al fondo */}
      <div className="absolute inset-0 opacity-[0.16] pointer-events-none" aria-hidden="true">
        <div className="grid grid-cols-7 gap-2 rotate-[-4deg] scale-110 -mt-10">
          {muro.map((m, i) => (
            <motion.img key={m.id} src={poster(m.p, 154)!} alt=""
              className="rounded-md w-full object-cover aspect-[2/3]"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.7 }} />
          ))}
        </div>
        <div className="absolute inset-0" style={{ background: "radial-gradient(80% 70% at 50% 45%, transparent 0%, #0a0a0d 78%)" }} />
      </div>
      <div className="relative max-w-[1500px] mx-auto px-6 md:px-12 text-center">
        <motion.p variants={rise} className="kicker mb-5">The Movies Database · un experimento personal con IA</motion.p>
        <motion.h1 variants={rise} className="font-display font-semibold leading-[0.98]"
          style={{ fontSize: "clamp(3rem, 9vw, 8.5rem)" }}>
          El cine de<br /><span className="text-marquee">Samuel</span>.
        </motion.h1>
        <motion.p variants={rise} className="mt-6 text-lg md:text-xl text-ivory-dim max-w-2xl mx-auto leading-relaxed">
          Tu historial completo de Trakt cruzado con 45.000 películas de The Movies Dataset:
          tu vida en cine, tu galaxia, tu grafo y un recomendador entrenado con tu propio gusto.
        </motion.p>
        <motion.div variants={rise} className="mt-12 flex flex-wrap justify-center gap-x-14 gap-y-6">
          {stats && [
            { v: stats.total_vistas, l: "películas vistas" },
            { v: horas, l: "horas de cine" },
            { v: Math.round(horas / 24), l: "días enteros" },
            { v: stats.plays, l: "visionados" },
          ].map((k) => (
            <div key={k.l} className="text-center">
              <CountUp to={k.v} className="font-display text-5xl md:text-6xl font-semibold text-marquee" />
              <div className="text-xs text-faint mt-1 tracking-[0.15em] uppercase">{k.l}</div>
            </div>
          ))}
        </motion.div>
        <motion.div variants={rise} className="mt-12 flex flex-wrap justify-center gap-3">
          {[["vida", "Tu vida en cine"], ["galaxia", "La galaxia"], ["grafo", "El grafo"], ["noche", "¿Qué veo esta noche?"]].map(([id, l]) => (
            <button key={id} onClick={() => irA(id)}
              className="px-5 py-2.5 rounded-full border border-hairline bg-stage-soft text-sm hover:border-marquee hover:text-marquee transition-colors">
              {l}
            </button>
          ))}
        </motion.div>
        {stats && stats.rewatch[0]?.id && (
          <motion.p variants={rise} className="mt-10 text-xs text-faint">
            Tu película más repetida: <button className="text-marquee hover:underline" onClick={() => onFicha(stats.rewatch[0].id!)}>
              {stats.rewatch[0].t}</button> ({stats.rewatch[0].n} veces)
          </motion.p>
        )}
      </div>
    </motion.section>
  );
}
