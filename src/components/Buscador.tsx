import { useId, useState, type ReactNode } from "react";
import { LARGO_MINIMO_BUSQUEDA } from "../lib/texto";

// Campo de búsqueda con desplegable de resultados, usable con teclado:
// flechas para moverse, Enter para elegir, Escape para limpiar.
export function Buscador<T>({ placeholder, buscar, claveDe, render, onElegir, valor, onValor, limpiarAlElegir = true, className = "" }: {
  placeholder: string;
  buscar: (consulta: string) => T[];
  claveDe: (item: T) => string | number;
  render: (item: T) => ReactNode;
  onElegir: (item: T) => void;
  valor?: string; // controlado desde fuera (opcional)
  onValor?: (v: string) => void;
  limpiarAlElegir?: boolean;
  className?: string;
}) {
  const [interno, setInterno] = useState("");
  const [activo, setActivo] = useState(0);
  const [abierto, setAbierto] = useState(true);
  const q = valor ?? interno;
  const setQ = (v: string) => { (onValor ?? setInterno)(v); setActivo(0); setAbierto(true); };
  const resultados = abierto && q.trim().length >= LARGO_MINIMO_BUSQUEDA ? buscar(q) : [];
  const idLista = useId();

  const elegir = (item: T) => {
    onElegir(item);
    if (limpiarAlElegir) setQ(""); else setAbierto(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && resultados.length) { e.preventDefault(); setActivo((i) => (i + 1) % resultados.length); }
    else if (e.key === "ArrowUp" && resultados.length) { e.preventDefault(); setActivo((i) => (i - 1 + resultados.length) % resultados.length); }
    else if (e.key === "Enter" && resultados[activo]) { e.preventDefault(); elegir(resultados[activo]); }
    else if (e.key === "Escape" && q) { e.preventDefault(); e.stopPropagation(); setQ(""); }
  };

  return (
    <div className={`relative min-w-[240px] flex-1 max-w-sm ${className}`}>
      <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder}
        role="combobox" aria-expanded={resultados.length > 0} aria-controls={idLista} aria-autocomplete="list"
        aria-label={placeholder}
        className="w-full rounded-xl border border-hairline bg-stage-soft px-4 py-2.5 text-sm outline-none focus:border-marquee" />
      {resultados.length > 0 && (
        <ul id={idLista} role="listbox" className="absolute z-30 top-full mt-1 w-full rounded-xl border border-hairline bg-stage-soft overflow-hidden shadow-2xl">
          {resultados.map((item, i) => (
            <li key={claveDe(item)} role="option" aria-selected={i === activo}>
              <button type="button" onClick={() => elegir(item)} onMouseEnter={() => setActivo(i)}
                className={`block w-full text-left px-4 py-2 text-sm ${i === activo ? "bg-stage text-marquee" : ""}`}>
                {render(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
