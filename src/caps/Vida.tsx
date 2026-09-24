import { useMemo } from "react";
import EChart from "../components/EChart";
import { EstadoCarga } from "../components/EstadoCarga";
import { Avatar, Poster } from "../components/Poster";
import { Bloque, Card, Item } from "../components/ui";
import { formatoNumero } from "../lib/format";
import { maximo, proporcion } from "../lib/numeros";
import type { Stats } from "../lib/schema";
import { COLOR, EJE, TOOLTIP } from "../lib/theme";
import { useDatos } from "../lib/useDatos";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function Vida({ onFicha }: { onFicha: (id: number) => void }) {
  const r = useDatos(["stats"] as const);
  const st = r.estado === "listo" ? r.datos[0] : null;
  const opciones = useMemo(() => (st ? graficos(st) : null), [st]);
  if (!st || !opciones) return <EstadoCarga estado={r} texto="Cargando tu vida en cine…" onReintentar={r.reintentar} />;

  const repetidas = st.rewatch.filter((x) => x.id != null && x.p).slice(0, 14);
  const rankings: [string, Stats["top_directores"]][] = [["Tus directores", st.top_directores], ["Tus actores", st.top_actores], ["Tus géneros", st.top_generos]];

  return (
    <div>
      <Bloque kicker="Capítulo 1 · tu vida en cine"
        titulo={<>Un <span className="text-marquee">Wrapped</span> permanente.</>}
        intro={<>Cada barra, cada celda y cada póster de este capítulo sale de tus {formatoNumero(st.plays)} visionados
          registrados en Trakt. Las {formatoNumero(st.post2017)} películas posteriores a 2017, que el dataset no cubre,
          se completaron con la API de TMDB.</>}>
        <div className="grid lg:grid-cols-2 gap-6 mt-10">
          <Card titulo="Tu línea temporal (visionados por mes)"><EChart option={opciones.mensual} height={260} etiqueta="Visionados por mes" /></Card>
          <Card titulo="Cuándo ves cine (día × hora)"><EChart option={opciones.heat} height={260} etiqueta="Visionados por día de la semana y hora" /></Card>
          <Card titulo="De qué época es tu cine (décadas de estreno)"><EChart option={opciones.decadas} height={300} etiqueta="Películas vistas por década de estreno" /></Card>
          <Card titulo="Tus más repetidas">
            {repetidas.length === 0 ? <p className="text-sm text-faint">Aún no has repetido ninguna película.</p> : (
              <div className="grid grid-cols-7 gap-2">
                {repetidas.map((x) => (
                  <button type="button" key={x.id} onClick={() => onFicha(x.id!)} title={`${x.t} · ${x.n} veces`}
                    className="relative rounded-lg overflow-hidden border border-hairline hover:border-marquee transition-colors aspect-[2/3] bg-stage">
                    <Poster ruta={x.p} alt={x.t} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-stage/85 text-marquee rounded px-1.5 py-0.5">×{x.n}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {rankings.map(([titulo, lista]) => {
            const tope = maximo(lista.map((d) => d.c));
            return (
              <Card key={titulo} titulo={titulo}>
                {lista.length === 0 && <p className="text-sm text-faint">Sin datos todavía.</p>}
                {lista.slice(0, 9).map((d, i) => (
                  <div key={d.n} className="flex items-center gap-3 py-1.5">
                    <span className="text-faint text-xs w-4 text-right">{i + 1}</span>
                    <Avatar ruta={d.p} nombre={d.n} tamano="h-8 w-8" className="text-[10px]" />
                    <span className="flex-1 text-sm truncate">{d.n}</span>
                    <span className="h-1.5 rounded-full bg-marquee/70" style={{ width: `${proporcion(d.c, tope) * 90}px` }} />
                    <span className="text-xs text-faint w-7 text-right">{d.c}</span>
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
        <Item className="mt-8 text-sm text-faint max-w-3xl">
          Tus {formatoNumero(st.ratings.length)} películas puntuadas se guardan para la segunda etapa del modelo:
          cuando haya suficientes notas, el recomendador aprenderá también qué disfrutas, no solo qué eliges
          (más en «Tu gusto»).
        </Item>
      </Bloque>
    </div>
  );
}

function graficos(st: Stats) {
  const mensual = {
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: st.mensual.map((m) => m[0]), ...EJE, axisLabel: { ...EJE.axisLabel, interval: 11 }, splitLine: { show: false } },
    yAxis: { type: "value", ...EJE },
    series: [{ type: "bar", data: st.mensual.map((m) => m[1]), itemStyle: { color: COLOR.marquee, borderRadius: [3, 3, 0, 0] } }],
    tooltip: { trigger: "axis", ...TOOLTIP },
  };
  const heat = {
    grid: { left: 50, right: 20, top: 10, bottom: 40 },
    xAxis: { type: "category", data: Array.from({ length: 24 }, (_, h) => `${h}h`), ...EJE, axisLabel: { ...EJE.axisLabel, interval: 2 }, splitLine: { show: false } },
    yAxis: { type: "category", data: DIAS, ...EJE, splitLine: { show: false } },
    // max al menos 1: con un historial vacío la escala no se rompe
    visualMap: { show: false, min: 0, max: Math.max(1, maximo(st.semana_hora.flat())), inRange: { color: [COLOR.stageSoft, "#3a2f14", COLOR.marquee] } },
    series: [{ type: "heatmap", data: st.semana_hora.flatMap((fila, d) => fila.map((v, h) => [h, d, v])) }],
    tooltip: { formatter: (p: { value: [number, number, number] }) => `${DIAS[p.value[1]]} ${p.value[0]}h · ${p.value[2]} visionados`, ...TOOLTIP },
  };
  const decadas = {
    grid: { left: 60, right: 30, top: 10, bottom: 30 },
    xAxis: { type: "value", ...EJE },
    yAxis: { type: "category", data: st.decadas.map((d) => `${d[0]}s`), ...EJE, axisLabel: { color: COLOR.ivoryDim }, splitLine: { show: false } },
    series: [{ type: "bar", data: st.decadas.map((d) => d[1]), itemStyle: { color: COLOR.blood, borderRadius: [0, 3, 3, 0] }, label: { show: true, position: "right", color: COLOR.faint } }],
  };
  return { mensual, heat, decadas };
}
