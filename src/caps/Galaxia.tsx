import { useEffect, useRef, useState } from "react";
import { Deck, OrthographicView } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Chip } from "../components/Chip";
import { EstadoCarga } from "../components/EstadoCarga";
import { Poster } from "../components/Poster";
import { Bloque, Item } from "../components/ui";
import { formatoNumero } from "../lib/format";
import { colorPunto, limites, puntoVisible, radioPunto, vistaInicial } from "../lib/galaxia";
import { colorGenero, GENEROS_FILTRABLES, generoEs } from "../lib/generos";
import type { GalaxiaPunto } from "../lib/schema";
import { useDatos } from "../lib/useDatos";

type Hover = { p: GalaxiaPunto; left: number; top: number };

// La galaxia: todas las películas del dataset proyectadas por similitud de contenido (UMAP sobre embeddings).
export default function Galaxia({ onFicha }: { onFicha: (id: number) => void }) {
  const r = useDatos(["galaxia"] as const);
  const datos = r.estado === "listo" ? r.datos[0] : null;
  const el = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Deck<OrthographicView> | null>(null);
  const [soloMias, setSoloMias] = useState(false);
  const [genero, setGenero] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const onFichaRef = useRef(onFicha);
  useEffect(() => { onFichaRef.current = onFicha; }, [onFicha]);

  useEffect(() => {
    if (!el.current || !datos) return;
    const contenedor = el.current;
    const deck = new Deck<OrthographicView>({
      parent: contenedor,
      views: new OrthographicView({ flipY: false }),
      initialViewState: vistaInicial(limites(datos), contenedor.clientHeight),
      controller: true,
      style: { position: "absolute", inset: "0" },
      onHover: (info) => {
        if (!info.object) { setHover(null); return; }
        // posición del tooltip calculada en el evento (no en el render), acotada al contenedor
        const w = contenedor.clientWidth, h = contenedor.clientHeight;
        const x = info.x ?? 0, y = info.y ?? 0;
        setHover({ p: info.object as GalaxiaPunto, left: Math.max(8, Math.min(x + 14, w - 290)), top: Math.max(8, Math.min(y + 14, h - 90)) });
      },
      onClick: (info) => { const o = info.object as GalaxiaPunto | undefined; if (o) onFichaRef.current(o.id); },
      layers: [],
    });
    deckRef.current = deck;
    return () => { deck.finalize(); deckRef.current = null; };
  }, [datos]);

  useEffect(() => {
    if (!deckRef.current || !datos) return;
    deckRef.current.setProps({
      layers: [
        new ScatterplotLayer<GalaxiaPunto>({
          id: "estrellas",
          data: datos.filter((p) => puntoVisible(p, soloMias, genero)),
          pickable: true,
          getPosition: (d) => [d.x, d.y],
          getRadius: radioPunto,
          radiusUnits: "common",
          getFillColor: colorPunto,
          stroked: false,
          antialiasing: true,
        }),
      ],
    });
  }, [datos, soloMias, genero]);

  return (
    <Bloque kicker="Capítulo 2 · la galaxia"
      titulo={<>{formatoNumero(datos?.length ?? 0)} películas, <span className="text-marquee">las tuyas encendidas</span>.</>}
      intro="Cada punto es una película, colocada por similitud de contenido (sinopsis, género, keywords). Las brillantes son las que has visto: se agrupan solas en tus territorios. Rueda para hacer zoom, arrastra para viajar, clic para abrir la ficha.">
      {!datos ? <EstadoCarga estado={r} texto="Cargando la galaxia…" onReintentar={r.reintentar} /> : (
        <>
          <Item className="mt-6 flex flex-wrap items-center gap-2">
            <Chip activo={soloMias} onClick={() => setSoloMias(!soloMias)}>{soloMias ? "★ Solo lo mío" : "Todo el universo"}</Chip>
            {GENEROS_FILTRABLES.map((g) => (
              <Chip key={g} variante="contorno" activo={genero === g} color={colorGenero(g)} onClick={() => setGenero(genero === g ? null : g)}>
                {generoEs(g)}
              </Chip>
            ))}
          </Item>
          <Item className="relative mt-5 rounded-2xl border border-hairline overflow-hidden">
            <div ref={el} className="relative w-full" role="img" aria-label="Galaxia de películas: cada punto es una película; las vistas, encendidas"
              style={{ height: "72vh", background: "radial-gradient(90% 90% at 50% 40%, #101017 0%, #0a0a0d 100%)" }} />
            {hover && (
              <div className="absolute z-10 pointer-events-none rounded-xl border border-hairline bg-stage-soft/95 backdrop-blur px-3 py-2.5 flex gap-3 items-center max-w-xs"
                style={{ left: hover.left, top: hover.top }}>
                <Poster ruta={hover.p.p} ancho={92} alt="" className="w-12 rounded-md" diferida={false} />
                <div>
                  <div className="text-sm font-semibold leading-tight">{hover.p.t}</div>
                  <div className="text-xs text-faint mt-0.5">{hover.p.a} · {generoEs(hover.p.g)}{hover.p.v ? " · ★ vista" : ""}</div>
                </div>
              </div>
            )}
          </Item>
          <Item className="mt-4 text-sm text-faint max-w-3xl">
            Territorios sin encender = cine que aún no has pisado. Prueba a filtrar por género y busca los huecos.
          </Item>
        </>
      )}
    </Bloque>
  );
}
