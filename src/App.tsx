import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Marquesina from "./caps/Marquesina";
import FichaModal from "./FichaModal";
import PersonaModal from "./PersonaModal";
import { formatoNumero } from "./lib/format";
import { useDatos } from "./lib/useDatos";
import { CAPS, capDesdeHash, type CapId } from "./navegacion";

// Cada capítulo se descarga al visitarlo: la portada no paga ECharts ni deck.gl.
const Vida = lazy(() => import("./caps/Vida"));
const Galaxia = lazy(() => import("./caps/Galaxia"));
const Grafo = lazy(() => import("./caps/Grafo"));
const Noche = lazy(() => import("./caps/Noche"));
const Formula = lazy(() => import("./caps/Formula"));
const Industria = lazy(() => import("./caps/Industria"));

export default function App() {
  const [cap, setCap] = useState<CapId>(() => capDesdeHash(location.hash));
  const [ficha, setFicha] = useState<number | null>(null);
  const [persona, setPersona] = useState<string | null>(null);

  const irA = (c: CapId) => {
    setCap(c);
    location.hash = c;
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const onHash = () => setCap(capDesdeHash(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain min-h-screen bg-stage">
        {/* marquesina de navegación */}
        <header className="sticky top-0 z-[80] bg-stage/85 backdrop-blur-md border-b border-hairline marquee-glow">
          <div className="max-w-[1500px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between gap-4">
            <button type="button" onClick={() => irA("inicio")} className="font-display font-semibold text-lg whitespace-nowrap">
              The Movies <span className="text-marquee">DB</span><span className="text-blood">.</span>
            </button>
            <nav className="flex gap-1 overflow-x-auto no-scrollbar" aria-label="Capítulos">
              {CAPS.slice(1).map((c) => (
                <button type="button" key={c.id} onClick={() => irA(c.id)} aria-current={cap === c.id ? "page" : undefined}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${cap === c.id ? "bg-marquee text-stage font-bold" : "text-ivory-dim hover:text-marquee"}`}>
                  {c.nav}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <Suspense fallback={<p role="status" className="text-center text-faint py-20">Cargando…</p>}>
          <AnimatePresence mode="wait">
            <motion.main key={cap}
              initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: [0.22, 0.7, 0.2, 1] }}>
              {cap === "inicio" && <Marquesina onFicha={setFicha} irA={irA} />}
              {cap === "vida" && <Vida onFicha={setFicha} />}
              {cap === "galaxia" && <Galaxia onFicha={setFicha} />}
              {cap === "grafo" && <Grafo onFicha={setFicha} />}
              {cap === "noche" && <Noche onFicha={setFicha} />}
              {cap === "formula" && <Formula />}
              {cap === "industria" && <Industria onFicha={setFicha} />}
            </motion.main>
          </AnimatePresence>
        </Suspense>

        <Pie />

        {/* Los modales se montan solo al abrirse: sus datos se descargan la primera vez que se usan. */}
        <AnimatePresence>
          {ficha != null && (
            <FichaModal key="ficha" id={ficha} onClose={() => setFicha(null)} onOpen={setFicha} onPersona={setPersona} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {persona != null && (
            <PersonaModal key="persona" nombre={persona} onClose={() => setPersona(null)}
              onPeli={(id) => { setPersona(null); setFicha(id); }} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function Pie() {
  const r = useDatos(["stats"] as const);
  const auc = r.estado === "listo" ? r.datos[0].resumen.auc : null;
  return (
    <footer className="border-t border-hairline mt-10">
      <div className="max-w-[1500px] mx-auto px-6 md:px-12 py-8 text-xs text-faint flex flex-wrap gap-x-6 gap-y-2 items-center">
        <span>The Movies Database · experimento personal de Samuel Ortega con IA</span>
        <span>Datos: The Movies Dataset (Kaggle · TMDB + MovieLens, hasta 2017) + export de Trakt</span>
        <span>Imágenes y datos de películas: TMDB (este producto usa la API de TMDB sin estar respaldado ni certificado por TMDB)</span>
        <span>ML: regresión logística{auc != null ? ` · AUC ${formatoNumero(auc, 3)}` : ""}</span>
      </div>
    </footer>
  );
}
