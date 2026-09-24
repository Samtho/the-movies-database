import { EstadoCarga } from "./components/EstadoCarga";
import { Modal } from "./components/Modal";
import { Avatar, Poster } from "./components/Poster";
import { formatoFecha, formatoNumero } from "./lib/format";
import { generoEs } from "./lib/generos";
import { useDatos } from "./lib/useDatos";

const MAX_SIMILARES = 12;

// Ficha universal (espíritu Obsidian): todo lo clicable abre esto; las personas
// también son clicables y llevan a su propia ficha con TU historial.
export default function FichaModal({ id, onClose, onOpen, onPersona }: {
  id: number; onClose: () => void; onOpen: (id: number) => void; onPersona: (nombre: string) => void;
}) {
  const r = useDatos(["fichas", "similares", "vistas", "gusto"] as const);
  if (r.estado !== "listo") {
    return <Modal titulo="Ficha de película" onClose={onClose} capa={95}><EstadoCarga estado={r} texto="Cargando…" onReintentar={r.reintentar} /></Modal>;
  }
  const [fichas, similares, vistas, gusto] = r.datos;
  const f = fichas[String(id)];
  if (!f) {
    return <Modal titulo="Ficha de película" onClose={onClose} capa={95}><p className="text-faint text-sm py-10 text-center">Sin ficha disponible para esta película.</p></Modal>;
  }
  const vista = vistas[String(id)];
  const candidata = vista ? undefined : gusto.candidatos.find((c) => c.id === id);
  const porques = (candidata?.r ?? []).map((i) => gusto.leyenda[i]).filter(Boolean);
  const parecidas = (similares[String(id)] ?? []).filter((s) => s !== id && fichas[String(s)]).slice(0, MAX_SIMILARES);

  return (
    <Modal titulo={`Ficha de ${f.t}`} onClose={onClose} capa={95}>
      <div className="flex flex-col md:flex-row gap-8">
        <Poster ruta={f.p} ancho={342} alt={f.t} diferida={false} className="w-52 md:w-72 rounded-2xl border border-hairline shadow-2xl self-start" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold leading-tight pr-10" style={{ fontSize: "clamp(1.9rem, 3.4vw, 3rem)" }}>{f.t}</h3>
          {f.te && <p className="text-sm text-faint mt-1">En español: {f.te}</p>}
          <p className="text-[15px] text-ivory-dim mt-2">
            {f.a} · {f.g.map(generoEs).join(" · ")}{f.rt ? ` · ${f.rt} min` : ""}
            {f.va ? ` · ★ ${formatoNumero(f.va, 1)} (${formatoNumero(f.nv)} votos)` : ""}
          </p>
          <div className="flex flex-wrap gap-2 mt-3.5">
            {vista && (
              <span className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-leaf/15 text-leaf border border-leaf/40">
                LA VISTE el {formatoFecha(vista.d)}{vista.n > 1 ? ` · ${vista.n} veces` : ""}
              </span>
            )}
            {candidata && (
              <span className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-marquee/15 text-marquee border border-marquee/40">
                AFINIDAD {Math.round(candidata.s * 100)}%
              </span>
            )}
            {porques.map((p) => (
              <span key={p} className="text-[12px] px-3 py-1.5 rounded-full bg-stage border border-hairline text-ivory-dim">{p}</span>
            ))}
          </div>
          {f.o && <p className="text-[15px] text-ivory-dim mt-4 leading-relaxed">{f.o}</p>}
          <div className="mt-6 flex flex-wrap gap-x-7 gap-y-4">
            {f.d && <PersonaBoton nombre={f.d} foto={f.dp} rol="Dirección" onPersona={onPersona} />}
            {f.c.map((a, i) => <PersonaBoton key={a} nombre={a} foto={f.cp?.[i]} rol="Reparto" onPersona={onPersona} />)}
          </div>
          {parecidas.length > 0 && (
            <div className="mt-7">
              <p className="kicker kicker-sm mb-3">Si te gustó esta…</p>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {parecidas.map((s) => {
                  const sf = fichas[String(s)];
                  return (
                    <button type="button" key={s} onClick={() => onOpen(s)} title={`${sf.t} (${sf.a})`} aria-label={`${sf.t} (${sf.a})`}
                      className="relative rounded-lg overflow-hidden border border-hairline hover:border-marquee transition-colors aspect-[2/3] bg-stage">
                      <Poster ruta={sf.p} alt="" className="w-full h-full object-cover" />
                      <span className="absolute inset-x-1 bottom-1 text-[9px] text-faint truncate pointer-events-none">{sf.t}</span>
                      {sf.v === 1 && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-leaf shadow" aria-label="vista" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Botón de persona (dirección o reparto): foto o inicial, y abre su ficha.
function PersonaBoton({ nombre, foto, rol, onPersona }: {
  nombre: string; foto: string | null | undefined; rol: string; onPersona: (nombre: string) => void;
}) {
  return (
    <button type="button" onClick={() => onPersona(nombre)} className="flex items-center gap-2.5 group text-left">
      <Avatar ruta={foto} nombre={nombre} tamano="h-12 w-12" className="text-sm group-hover:border-marquee transition-colors" />
      <div>
        <div className="text-sm font-semibold leading-tight group-hover:text-marquee transition-colors">{nombre}</div>
        <div className="text-[10px] text-faint uppercase tracking-wide">{rol}</div>
      </div>
    </button>
  );
}
