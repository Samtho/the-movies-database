import { motion } from "motion/react";
import { EstadoCarga } from "../components/EstadoCarga";
import { Poster } from "../components/Poster";
import { CountUp } from "../components/ui";
import { formatoNumero } from "../lib/format";
import { rise, stagger } from "../lib/motion";
import { useDatos } from "../lib/useDatos";
import type { CapId } from "../navegacion";

const ATAJOS: [CapId, string][] = [["vida", "Tu vida en cine"], ["galaxia", "La galaxia"], ["grafo", "El grafo"], ["noche", "¿Qué veo esta noche?"]];

// Portada: marquesina de cine con muro de pósters reales del historial.
// Solo necesita stats.json (~13 KB): el muro viene precalculado por el pipeline.
export default function Marquesina({ onFicha, irA }: { onFicha: (id: number) => void; irA: (cap: CapId) => void }) {
  const r = useDatos(["stats"] as const);
  if (r.estado !== "listo") {
    return <div className="min-h-[92vh] grid place-items-center"><EstadoCarga estado={r} texto="Cargando…" onReintentar={r.reintentar} /></div>;
  }
  const [stats] = r.datos;
  const horas = Math.round(stats.minutos / 60);
  const masRepetida = stats.rewatch.find((x) => x.id != null);
  const kpis = [
    { v: stats.total_vistas, l: "películas vistas" },
    { v: horas, l: "horas de cine" },
    { v: Math.round(horas / 24), l: "días enteros" },
    { v: stats.plays, l: "visionados" },
  ];

  return (
    <motion.section variants={stagger} initial="hidden" animate="show" className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden">
      {/* muro de pósters al fondo */}
      <div className="absolute inset-0 opacity-[0.16] pointer-events-none" aria-hidden="true">
        <div className="grid grid-cols-7 gap-2 rotate-[-4deg] scale-110 -mt-10">
          {stats.muro.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.7 }}>
              <Poster ruta={m.p} ancho={154} alt="" diferida={false} className="rounded-md w-full object-cover aspect-[2/3]" />
            </motion.div>
          ))}
        </div>
        <div className="absolute inset-0" style={{ background: "radial-gradient(80% 70% at 50% 45%, transparent 0%, #0a0a0d 78%)" }} />
      </div>
      <div className="relative max-w-[1500px] mx-auto px-6 md:px-12 text-center">
        <motion.p variants={rise} className="kicker mb-5">The Movies Database · un experimento personal con IA</motion.p>
        <motion.h1 variants={rise} className="font-display font-semibold leading-[0.98]" style={{ fontSize: "clamp(3rem, 9vw, 8.5rem)" }}>
          El cine de<br /><span className="text-marquee">Samuel</span>.
        </motion.h1>
        <motion.p variants={rise} className="mt-6 text-lg md:text-xl text-ivory-dim max-w-2xl mx-auto leading-relaxed">
          Tu historial completo de Trakt cruzado con {formatoNumero(stats.resumen.universo)} películas de The Movies Dataset:
          tu vida en cine, tu galaxia, tu grafo y un recomendador entrenado con tu propio gusto.
        </motion.p>
        <motion.div variants={rise} className="mt-12 flex flex-wrap justify-center gap-x-14 gap-y-6">
          {kpis.map((k) => (
            <div key={k.l} className="text-center">
              <CountUp to={k.v} className="font-display text-5xl md:text-6xl font-semibold text-marquee" />
              <div className="text-xs text-faint mt-1 tracking-[0.15em] uppercase">{k.l}</div>
            </div>
          ))}
        </motion.div>
        <motion.div variants={rise} className="mt-12 flex flex-wrap justify-center gap-3">
          {ATAJOS.map(([id, l]) => (
            <button type="button" key={id} onClick={() => irA(id)}
              className="px-5 py-2.5 rounded-full border border-hairline bg-stage-soft text-sm hover:border-marquee hover:text-marquee transition-colors">
              {l}
            </button>
          ))}
        </motion.div>
        {masRepetida?.id != null && (
          <motion.p variants={rise} className="mt-10 text-xs text-faint">
            Tu película más repetida:{" "}
            <button type="button" className="text-marquee hover:underline" onClick={() => onFicha(masRepetida.id!)}>{masRepetida.t}</button>{" "}
            ({masRepetida.n} veces)
          </motion.p>
        )}
      </div>
    </motion.section>
  );
}
