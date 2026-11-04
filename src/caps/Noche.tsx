import { useMemo, useState } from "react";
import { Buscador } from "../components/Buscador";
import { Chip } from "../components/Chip";
import { EstadoCarga } from "../components/EstadoCarga";
import { TarjetaPelicula } from "../components/TarjetaPelicula";
import { Bloque, Item } from "../components/ui";
import { formatoNumero } from "../lib/format";
import { generoEs } from "../lib/generos";
import {
  buscarPeliculas, decadasDe, elegirSorpresa, filtrarCandidatas, generosFrecuentes,
  MINUTOS_MAX, MINUTOS_MIN, porcentajeScore, TOPE_SORPRESA, unirCandidatas, unirPorque, type FiltrosNoche, type GrupoConFichas,
} from "../lib/noche";
import { COLOR } from "../lib/theme";
import { useDatos } from "../lib/useDatos";


// ¿Qué veo esta noche? El recomendador personal: candidatas NO vistas, ordenadas por el modelo de gusto.
export default function Noche({ onFicha }: { onFicha: (id: number) => void }) {
  const r = useDatos(["fichas", "gusto"] as const);
  const [filtros, setFiltros] = useState<FiltrosNoche>({ genero: null, decada: null, maxMinutos: MINUTOS_MAX });
  const [sorpresa, setSorpresa] = useState<number | null>(null);

  const datos = r.estado === "listo" ? r.datos : null;
  const todas = useMemo(() => (datos ? unirCandidatas(datos[1].candidatos, datos[0]) : []), [datos]);
  const grupos = useMemo(() => (datos ? unirPorque(datos[1].porque.grupos, datos[0]) : []), [datos]);
  const generos = useMemo(() => generosFrecuentes(todas), [todas]);
  const decadas = useMemo(() => decadasDe(todas), [todas]);
  const candidatas = useMemo(() => filtrarCandidatas(todas, filtros), [todas, filtros]);

  // cualquier cambio de filtro anula la sorpresa: la sorpresa siempre sale de la lista visible
  const cambiarFiltros = (cambio: Partial<FiltrosNoche>) => { setFiltros((f) => ({ ...f, ...cambio })); setSorpresa(null); };

  if (!datos) {
    return <Bloque kicker="Capítulo 4 · ¿qué veo esta noche?"><EstadoCarga estado={r} texto="Cargando tus candidatas…" onReintentar={r.reintentar} /></Bloque>;
  }
  const [fichas, gusto] = datos;
  const lista = sorpresa != null ? candidatas.filter((c) => c.id === sorpresa) : candidatas.slice(0, 30);
  const porques = (idx: number[]) => idx.map((i) => gusto.leyenda[i]).filter(Boolean);

  return (
    <>
    <Bloque kicker="Capítulo 4 · ¿qué veo esta noche?"
      titulo={<>{formatoNumero(todas.length)} candidatas. <span className="text-marquee">Ninguna la has visto.</span></>}
      intro={gusto.notas.calidad_activa
        ? "Ordenadas por tu modelo de gusto (qué probabilidad hay de que la veas, según todo lo que ya has visto) y por su nota en TMDB, que es lo que mejor predice tus notas. Filtra por humor del día o pide una sorpresa."
        : "Ordenadas por tu modelo de gusto: qué probabilidad hay de que esta película sea para ti, según todo lo que ya has visto. Filtra por humor del día o pide una sorpresa."}>
      <Item className="mt-6 flex flex-wrap items-center gap-2">
        {generos.map((g) => (
          <Chip key={g} activo={filtros.genero === g} onClick={() => cambiarFiltros({ genero: filtros.genero === g ? null : g })}>{generoEs(g)}</Chip>
        ))}
        <select value={filtros.decada ?? ""} aria-label="Década de estreno"
          onChange={(e) => cambiarFiltros({ decada: e.target.value ? Number(e.target.value) : null })}
          className="rounded-full border border-hairline bg-stage-soft px-3 py-1.5 text-xs text-ivory-dim outline-none">
          <option value="">Cualquier década</option>
          {decadas.map((d) => <option key={d} value={d}>{d}s</option>)}
        </select>
        <label className="text-xs text-faint flex items-center gap-2 ml-1">
          Duración
          <input type="range" min={MINUTOS_MIN} max={MINUTOS_MAX} step={10} value={filtros.maxMinutos}
            onChange={(e) => cambiarFiltros({ maxMinutos: Number(e.target.value) })} style={{ accentColor: COLOR.marquee }} />
          <span className="w-24">{filtros.maxMinutos >= MINUTOS_MAX ? "cualquiera" : `≤ ${filtros.maxMinutos} min`}</span>
        </label>
        <button type="button" disabled={candidatas.length === 0}
          onClick={() => setSorpresa(elegirSorpresa(candidatas))}
          title={`Una al azar entre las ${TOPE_SORPRESA} mejores de la lista actual`}
          className="ml-auto px-4 py-1.5 rounded-full text-xs font-medium bg-blood/90 text-ivory hover:bg-blood transition-colors disabled:opacity-40">
          🎲 Sorpréndeme
        </button>
      </Item>
      <Item className="mt-4 max-w-md">
        <Buscador placeholder="…o busca una película para ver sus parecidas"
          buscar={(q) => buscarPeliculas(fichas, q)} claveDe={([id]) => id}
          render={([, f]) => <>{f.t} <span className="text-faint">({f.a}){f.v ? " · vista" : ""}</span></>}
          onElegir={([id]) => onFicha(id)} />
      </Item>
      {lista.length === 0 ? (
        <Item className="mt-10 text-center text-faint">
          <p>No hay candidatas con estos filtros.</p>
          <button type="button" className="mt-3 text-sm text-marquee hover:underline"
            onClick={() => cambiarFiltros({ genero: null, decada: null, maxMinutos: MINUTOS_MAX })}>Quitar filtros</button>
        </Item>
      ) : (
        <div data-testid="candidatas" className="mt-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {lista.map((c, i) => (
            <Item key={c.id}>
              <TarjetaPelicula f={c.f} onClick={() => onFicha(c.id)}
                insignia={<>{sorpresa == null && i < 3 ? `#${i + 1} · ` : ""}{porcentajeScore(c.s)}%</>}>
                {c.r.length > 0 && (
                  <div className="text-[11px] text-marquee/80 truncate" title={porques(c.r).join(" · ")}>
                    {porques(c.r.slice(0, 2)).join(" · ")}
                  </div>
                )}
                <div className="mt-1 h-1 rounded-full bg-hairline overflow-hidden">
                  <div className="h-full bg-marquee" style={{ width: `${c.s * 100}%` }} />
                </div>
              </TarjetaPelicula>
            </Item>
          ))}
        </div>
      )}
      {sorpresa != null && (
        <Item className="mt-5"><button type="button" onClick={() => setSorpresa(null)} className="text-sm text-marquee hover:underline">← volver a la lista completa</button></Item>
      )}
    </Bloque>
    {grupos.length > 0 && <PorqueTeGusto grupos={grupos} notaMin={gusto.porque.nota_min} onFicha={onFicha} />}
    </>
  );
}

// "Porque te gustó X": lo que TMDB recomienda a partir de tus favoritas. No depende del
// dataset de 2017, así que aquí sí aparecen estrenos.
function PorqueTeGusto({ grupos, notaMin, onFicha }: { grupos: GrupoConFichas[]; notaMin: number; onFicha: (id: number) => void }) {
  const [elegida, setElegida] = useState(grupos[0].origen.id);
  const grupo = grupos.find((g) => g.origen.id === elegida) ?? grupos[0];
  return (
    <Bloque kicker="Capítulo 4 · desde tus favoritas"
      titulo={<>Porque te gustó <span className="text-marquee">{grupo.origen.f.t}</span></>}
      intro={<>Lo que TMDB recomienda a partir de tus {formatoNumero(grupos.length)} favoritas en Trakt (nota {notaMin} o más), sin
        lo que ya viste. Aquí sí entran estrenos: estas sugerencias no salen del dataset de 2017.</>}>
      <Item className="mt-6"><div data-testid="porque-favoritas" className="flex flex-wrap gap-2">
        {grupos.map((g) => (
          <Chip key={g.origen.id} activo={g.origen.id === grupo.origen.id} onClick={() => setElegida(g.origen.id)}>
            {g.origen.f.t} <span className="tabular-nums opacity-70">· {g.n}</span>
          </Chip>
        ))}
      </div></Item>
      <div data-testid="porque" className="mt-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {grupo.recs.map((r) => (
          <Item key={r.id}>
            <TarjetaPelicula f={r.f} onClick={() => onFicha(r.id)} />
          </Item>
        ))}
      </div>
    </Bloque>
  );
}
