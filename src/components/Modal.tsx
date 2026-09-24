import { useEffect, useId, useRef, type ReactNode } from "react";
import { motion } from "motion/react";

// Pila de modales abiertos: Escape cierra solo el de arriba (abrir una persona desde
// una ficha deja la ficha debajo; Escape vuelve a ella en vez de cerrar las dos).
const pila: symbol[] = [];

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Carcasa común de ficha y persona: fondo, panel animado, cierre con Escape, clic fuera
// o botón ×, foco atrapado dentro mientras está abierto y devuelto al cerrar.
// Se monta dentro de <AnimatePresence> en quien lo abre, para animar la salida.
export function Modal({ titulo, onClose, capa, children }: {
  titulo: string; // nombre accesible del diálogo
  onClose: () => void;
  capa: number; // z-index
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const cerrar = useRef(onClose);
  useEffect(() => { cerrar.current = onClose; }, [onClose]);

  useEffect(() => {
    const token = Symbol("modal");
    pila.push(token);
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pila[pila.length - 1] === token) {
        e.stopPropagation();
        cerrar.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      pila.splice(pila.indexOf(token), 1);
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  // Tab y Mayús+Tab dan la vuelta dentro del panel
  const atraparFoco = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const nodos = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
    if (nodos.length === 0) { e.preventDefault(); return; }
    const primero = nodos[0], ultimo = nodos[nodos.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel.current)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  };

  return (
    <motion.div className="fixed inset-0 bg-stage/90 backdrop-blur-md overflow-y-auto no-scrollbar" style={{ zIndex: capa }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} onKeyDown={atraparFoco}
        className="relative max-w-5xl mx-auto my-8 md:my-14 rounded-3xl border border-hairline bg-stage-soft p-6 md:p-10 marquee-glow outline-none"
        initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 0.7, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}>
        <span id={idTitulo} className="sr-only">{titulo}</span>
        <button type="button" onClick={onClose} aria-label="Cerrar"
          className="absolute top-4 right-5 text-faint hover:text-marquee text-3xl leading-none z-10">×</button>
        {children}
      </motion.div>
    </motion.div>
  );
}
