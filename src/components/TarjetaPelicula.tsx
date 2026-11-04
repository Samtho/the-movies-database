import type { ReactNode } from "react";
import type { Ficha } from "../lib/schema";
import { Poster } from "./Poster";

// Tarjeta clicable de una película: póster (con una insignia opcional encima), título y
// año · duración. Lo que va debajo (porqués, barra de score) llega como children.
export function TarjetaPelicula({ f, onClick, insignia, children }: {
  f: Ficha;
  onClick: () => void;
  insignia?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <div className="relative rounded-xl overflow-hidden border border-hairline group-hover:border-marquee transition-colors aspect-[2/3] bg-stage-soft">
        <Poster ruta={f.p} ancho={342} alt={f.t} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          respaldo={<span className="absolute inset-x-2 top-8 text-xs text-faint">{f.t}</span>} />
        {insignia != null && (
          <span className="absolute top-1.5 left-1.5 text-[11px] font-medium tabular-nums bg-stage/85 text-marquee rounded px-1.5 py-0.5">
            {insignia}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm font-medium leading-tight truncate">{f.t}</div>
      <div className="text-xs text-faint">{f.a}{f.rt ? ` · ${f.rt} min` : ""}</div>
      {children}
    </button>
  );
}
