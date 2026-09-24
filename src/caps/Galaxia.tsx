import { useEffect, useRef, useState } from "react";
import { Deck, OrthographicView } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { carga, poster, gen_es, GENERO_COLOR, type GalaxiaPunto } from "../lib/data";
import { Bloque, Item } from "../lib/ui";

function hex2rgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// La galaxia: 15.752 películas proyectadas por similitud de contenido (UMAP sobre embeddings).
export default function Galaxia({ onFicha }: { onFicha: (id: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Deck<OrthographicView> | null>(null);
  const [datos, setDatos] = useState<GalaxiaPunto[] | null>(null);
  const [soloMias, setSoloMias] = useState(false);
  const [genero, setGenero] = useState<string | null>(null);
  const [hover, setHover] = useState<{ p: GalaxiaPunto; left: number; top: number } | null>(null);

  useEffect(() => { carga<GalaxiaPunto[]>("galaxia").then(setDatos); }, []);

  useEffect(() => {
    if (!el.current || !datos) return;
    const xs = datos.map((d) => d.x), ys = datos.map((d) => d.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const zoom = Math.log2((el.current.clientHeight * 0.9) / span);
    const deck = new Deck({
      parent: el.current,
      views: new OrthographicView({ flipY: false }),
      initialViewState: { target: [cx, cy, 0], zoom },
      controller: true,
      style: { position: "absolute", inset: "0" },
      onHover: (info) => {
        if (!info.object) { setHover(null); return; }
        // posición del tooltip calculada en el evento (no en el render), acotada al contenedor
        const w = el.current?.clientWidth ?? 600, h = el.current?.clientHeight ?? 400;
        const x = info.x ?? 0, y = info.y ?? 0;
        setHover({ p: info.object as GalaxiaPunto, left: Math.max(8, Math.min(x + 14, w - 290)), top: Math.max(8, Math.min(y + 14, h - 90)) });
      },
      onClick: (info) => { const o = info.object as GalaxiaPunto | undefined; if (o) onFicha(o.id); },
      layers: [],
    });
    deckRef.current = deck as Deck<OrthographicView>;
    return () => { deck.finalize(); deckRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  useEffect(() => {
    if (!deckRef.current || !datos) return;
    const visibles = datos.filter((d) => (!soloMias || d.v === 1) && (!genero || d.g === genero));
    deckRef.current.setProps({
      layers: [
        new ScatterplotLayer<GalaxiaPunto>({
          id: "stars", data: visibles, pickable: true,
          getPosition: (d) => [d.x, d.y],
          getRadius: (d) => (d.v ? 0.09 + d.s * 0.012 : 0.03 + d.s * 0.009),
          radiusUnits: "common",
          getFillColor: (d) => {
            const c = hex2rgb(GENERO_COLOR[d.g] ?? "#666666");
            return d.v ? [...c, 255] as [number, number, number, number] : [...c, 95] as [number, number, number, number];
          },
          stroked: false, antialiasing: true,
        }),
      ],
    });
  }, [datos, soloMias, genero]);

  const generos = Object.keys(GENERO_COLOR).filter((g) => !["Otro", "Foreign", "TV Movie"].includes(g)).slice(0, 12);
  return (
    <Bloque kicker="Capítulo 2 · la galaxia"
      titulo={<>{(datos?.length ?? 0).toLocaleString("es-ES")} películas, <span className="text-marquee">las tuyas encendidas</span>.</>}
      intro="Cada punto es una película, colocada por similitud de contenido (sinopsis, género, keywords). Las brillantes son las que has visto: se agrupan solas en tus territorios. Rueda para hacer zoom, arrastra para viajar, clic para abrir la ficha.">
      <Item className="mt-6 flex flex-wrap items-center gap-2">
        <button onClick={() => setSoloMias(!soloMias)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${soloMias ? "bg-marquee text-stage border-marquee" : "border-hairline text-ivory-dim hover:border-marquee"}`}>
          {soloMias ? "★ Solo lo mío" : "Todo el universo"}
        </button>
        {generos.map((g) => (
          <button key={g} onClick={() => setGenero(genero === g ? null : g)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${genero === g ? "border-marquee text-marquee" : "border-hairline text-faint hover:text-ivory-dim"}`}>
            <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: GENERO_COLOR[g] }} />{gen_es(g)}
          </button>
        ))}
      </Item>
      <Item className="relative mt-5 rounded-2xl border border-hairline overflow-hidden" >
        <div ref={el} className="relative w-full" style={{ height: "72vh", background: "radial-gradient(90% 90% at 50% 40%, #101017 0%, #0a0a0d 100%)" }} />
        {hover && (
          <div className="absolute z-10 pointer-events-none rounded-xl border border-hairline bg-stage-soft/95 backdrop-blur px-3 py-2.5 flex gap-3 items-center max-w-xs"
            style={{ left: hover.left, top: hover.top }}>
            {poster(hover.p.p, 92) && <img src={poster(hover.p.p, 92)!} alt="" className="w-12 rounded-md" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            <div>
              <div className="text-sm font-semibold leading-tight">{hover.p.t}</div>
              <div className="text-xs text-faint mt-0.5">{hover.p.a} · {gen_es(hover.p.g)}{hover.p.v ? " · ★ vista" : ""}</div>
            </div>
          </div>
        )}
      </Item>
      <Item className="mt-4 text-sm text-faint max-w-3xl">
        Territorios sin encender = cine que aún no has pisado. Prueba a filtrar por género y busca los huecos.
      </Item>
    </Bloque>
  );
}
