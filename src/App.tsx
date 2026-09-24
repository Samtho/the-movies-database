import { useEffect, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import Marquesina from "./caps/Marquesina";
import Vida from "./caps/Vida";
import Galaxia from "./caps/Galaxia";
import Grafo from "./caps/Grafo";
import Noche from "./caps/Noche";
import Formula from "./caps/Formula";
import Industria from "./caps/Industria";
import FichaModal from "./FichaModal";
import PersonaModal from "./PersonaModal";

const CAPS = [
  { id: "inicio", nav: "Inicio" },
  { id: "vida", nav: "Tu vida en cine" },
  { id: "galaxia", nav: "La galaxia" },
  { id: "grafo", nav: "El grafo" },
  { id: "noche", nav: "Esta noche" },
  { id: "formula", nav: "Tu gusto (ML)" },
  { id: "industria", nav: "La industria" },
] as const;
type CapId = (typeof CAPS)[number]["id"];

export default function App() {
  const [cap, setCap] = useState<CapId>(() => {
    const h = location.hash.replace("#", "");
    return (CAPS.some((c) => c.id === h) ? h : "inicio") as CapId;
  });
  const [ficha, setFicha] = useState<number | null>(null);
  const [persona, setPersona] = useState<string | null>(null);

  const irA = (c: string) => { setCap(c as CapId); location.hash = c; window.scrollTo({ top: 0 }); };
  useEffect(() => {
    const onHash = () => { const h = location.hash.replace("#", ""); if (CAPS.some((c) => c.id === h)) setCap(h as CapId); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="grain min-h-screen bg-stage">
        {/* marquesina de navegación */}
        <header className="sticky top-0 z-[80] bg-stage/85 backdrop-blur-md border-b border-hairline marquee-glow">
          <div className="max-w-[1500px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between gap-4">
            <button onClick={() => irA("inicio")} className="font-display font-semibold text-lg whitespace-nowrap">
              The Movies <span className="text-marquee">DB</span><span className="text-blood">.</span>
            </button>
            <nav className="flex gap-1 overflow-x-auto no-scrollbar">
              {CAPS.slice(1).map((c) => (
                <button key={c.id} onClick={() => irA(c.id)}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors ${cap === c.id ? "bg-marquee text-stage font-bold" : "text-ivory-dim hover:text-marquee"}`}>
                  {c.nav}
                </button>
              ))}
            </nav>
          </div>
        </header>

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

        <footer className="border-t border-hairline mt-10">
          <div className="max-w-[1500px] mx-auto px-6 md:px-12 py-8 text-xs text-faint flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span>The Movies Database · experimento personal de Samuel Ortega con IA</span>
            <span>Datos: The Movies Dataset (Kaggle · TMDB + MovieLens, hasta 2017) + export de Trakt</span>
            <span>Imágenes y datos de películas: TMDB (este producto usa la API de TMDB sin estar respaldado ni certificado por TMDB)</span>
            <span>ML: regresión logística · AUC 0,908</span>
          </div>
        </footer>

        <FichaModal id={ficha} onClose={() => setFicha(null)} onOpen={setFicha}
          onPersona={(n) => { setPersona(n); }} />
        <PersonaModal nombre={persona} onClose={() => setPersona(null)}
          onPeli={(id) => { setPersona(null); setFicha(id); }} />
      </div>
    </MotionConfig>
  );
}
