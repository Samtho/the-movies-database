import type { ReactNode } from "react";

// Botón-píldora de filtro. "solido": relleno ámbar cuando está activo (filtros
// principales); "contorno": solo borde (filtros secundarios, como géneros).
export function Chip({ activo, onClick, children, variante = "solido", color, className = "" }: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  variante?: "solido" | "contorno";
  color?: string; // punto de color delante del texto
  className?: string;
}) {
  const estilo = variante === "solido"
    ? activo ? "bg-marquee text-stage border-marquee font-bold" : "border-hairline text-ivory-dim hover:border-marquee"
    : activo ? "border-marquee text-marquee" : "border-hairline text-faint hover:text-ivory-dim";
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={`px-3.5 py-1.5 rounded-full text-xs border whitespace-nowrap transition-colors ${estilo} ${className}`}>
      {color && <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: color }} />}
      {children}
    </button>
  );
}
