import { useMemo } from "react";
import { EstadoCarga } from "./components/EstadoCarga";
import { Modal } from "./components/Modal";
import { Avatar, Poster } from "./components/Poster";
import { formatoFecha, formatoNumero } from "./lib/format";
import { filmografia, ultimaVista } from "./lib/personas";
import { useDatos } from "./lib/useDatos";

const MAX_PELIS = 30;

// Ficha de persona: su filmografía en esta base, con TU historial encima
// (qué has visto de ella y cuándo). Clic en una película -> su ficha.
export default function PersonaModal({ nombre, onClose, onPeli }: {
  nombre: string; onClose: () => void; onPeli: (id: number) => void;
}) {
  const r = useDatos(["fichas", "vistas"] as const);
  const fichas = r.estado === "listo" ? r.datos[0] : null;
  const info = useMemo(() => (fichas ? filmografia(nombre, fichas) : null), [nombre, fichas]);
  if (r.estado !== "listo" || !info) {
    return <Modal titulo={nombre} onClose={onClose} capa={97}><EstadoCarga estado={r} texto="Cargando…" onReintentar={r.reintentar} /></Modal>;
  }
  const vistas = r.datos[1];
  const vistasDe = info.pelis.filter((p) => p.f.v === 1);
  const ultima = ultimaVista(vistasDe, vistas);

  return (
    <Modal titulo={nombre} onClose={onClose} capa={97}>
      <div className="flex items-center gap-5 pr-10">
        <Avatar ruta={info.foto} nombre={nombre} ancho={342} tamano="h-24 w-24 md:h-32 md:w-32" className="text-3xl border-2 border-marquee/50 shadow-2xl" />
        <div>
          <h3 className="font-display font-semibold leading-tight" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.8rem)" }}>{nombre}</h3>
          <p className="text-[15px] text-ivory-dim mt-1.5">
            Has visto <strong className="text-marquee">{formatoNumero(vistasDe.length)}</strong> de sus {formatoNumero(info.pelis.length)} películas en esta base
            {ultima && <> · la última el {formatoFecha(ultima)}</>}
          </p>
        </div>
      </div>
      {info.pelis.length === 0 ? (
        <p className="mt-8 text-sm text-faint">No hay películas suyas en esta base.</p>
      ) : (
        <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {info.pelis.slice(0, MAX_PELIS).map((p) => {
            const v = vistas[String(p.id)];
            return (
              <button type="button" key={p.id} onClick={() => onPeli(p.id)} className="group text-left">
                <div className="relative rounded-xl overflow-hidden border border-hairline group-hover:border-marquee transition-colors aspect-[2/3] bg-stage">
                  <Poster ruta={p.f.p} alt={p.f.t} className="w-full h-full object-cover" />
                  <span className="absolute inset-x-1 bottom-1 text-[9px] text-faint truncate pointer-events-none">{p.f.t}</span>
                  {p.f.v === 1 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-leaf shadow" aria-label="vista" />}
                  {p.rol === "dirige" && <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-blood/90 text-ivory rounded px-1 py-0.5">DIR</span>}
                </div>
                <div className="mt-1.5 text-xs font-medium leading-tight truncate">{p.f.t}</div>
                <div className="text-[11px] text-faint">
                  {p.f.a}{v ? <span className="text-leaf"> · vista {formatoFecha(v.d)}</span> : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {info.pelis.length > MAX_PELIS && (
        <p className="mt-4 text-xs text-faint">Mostrando {MAX_PELIS} de {formatoNumero(info.pelis.length)} (primero las vistas, luego por año).</p>
      )}
    </Modal>
  );
}
