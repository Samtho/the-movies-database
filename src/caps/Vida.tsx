import { useEffect, useState } from "react";
import { carga, poster, type Ficha, type Stats } from "../lib/data";
import { Bloque, Card, Item } from "../lib/ui";
import EChart from "../components/EChart";

const C = { ink: "#f2ede1", dim: "#b6b0a2", faint: "#6e695e", line: "#26262e", amber: "#f0b429", blood: "#e0563f", leaf: "#58c99a" };
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function Vida({ onFicha }: { onFicha: (id: number) => void }) {
  const [st, setSt] = useState<Stats | null>(null);
  const [fichas, setFichas] = useState<Record<string, Ficha> | null>(null);
  useEffect(() => { carga<Stats>("stats").then(setSt); carga<Record<string, Ficha>>("fichas").then(setFichas); }, []);
  if (!st) return <p className="text-center text-faint py-20">Cargando tu vida en cine…</p>;

  const mensual = {
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: st.mensual.map((m) => m[0]), axisLabel: { color: C.faint, interval: 11 }, axisLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "value", axisLabel: { color: C.faint }, splitLine: { lineStyle: { color: C.line } } },
    series: [{ type: "bar", data: st.mensual.map((m) => m[1]), itemStyle: { color: C.amber, borderRadius: [3, 3, 0, 0] } }],
    tooltip: { trigger: "axis", backgroundColor: "#141419", borderColor: C.line, textStyle: { color: C.ink } },
  };
  const heat = {
    grid: { left: 50, right: 20, top: 10, bottom: 40 },
    xAxis: { type: "category", data: Array.from({ length: 24 }, (_, h) => `${h}h`), axisLabel: { color: C.faint, interval: 2 }, axisLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "category", data: DIAS, axisLabel: { color: C.faint }, axisLine: { lineStyle: { color: C.line } } },
    visualMap: { show: false, min: 0, max: Math.max(...st.semana_hora.flat()), inRange: { color: ["#141419", "#3a2f14", C.amber] } },
    series: [{ type: "heatmap", data: st.semana_hora.flatMap((fila, d) => fila.map((v, h) => [h, d, v])) }],
    tooltip: { formatter: (p: { value: [number, number, number] }) => `${DIAS[p.value[1]]} ${p.value[0]}h · ${p.value[2]} visionados`, backgroundColor: "#141419", borderColor: C.line, textStyle: { color: C.ink } },
  };
  const decadas = {
    grid: { left: 60, right: 30, top: 10, bottom: 30 },
    xAxis: { type: "value", axisLabel: { color: C.faint }, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "category", data: st.decadas.map((d) => `${d[0]}s`), axisLabel: { color: C.dim }, axisLine: { lineStyle: { color: C.line } } },
    series: [{ type: "bar", data: st.decadas.map((d) => d[1]), itemStyle: { color: C.blood, borderRadius: [0, 3, 3, 0] }, label: { show: true, position: "right", color: C.faint } }],
  };

  return (
    <div>
      <Bloque kicker="Capítulo 1 · tu vida en cine"
        titulo={<>Un <span className="text-marquee">Wrapped</span> permanente.</>}
        intro={<>Cada barra, cada celda y cada póster de este capítulo sale de tus {st.plays.toLocaleString("es-ES")} visionados
          registrados en Trakt. Las {st.post2017} películas que el dataset (hasta 2017) no cubre cuentan aquí también, aunque sin ficha.</>}>
        <div className="grid lg:grid-cols-2 gap-6 mt-10">
          <Card><p className="kicker mb-3" style={{ fontSize: 10 }}>Tu línea temporal (visionados por mes)</p><EChart option={mensual} height={260} /></Card>
          <Card><p className="kicker mb-3" style={{ fontSize: 10 }}>Cuándo ves cine (día × hora)</p><EChart option={heat} height={260} /></Card>
          <Card><p className="kicker mb-3" style={{ fontSize: 10 }}>De qué época es tu cine (décadas de estreno)</p><EChart option={decadas} height={300} /></Card>
          <Card>
            <p className="kicker mb-3" style={{ fontSize: 10 }}>Tus más repetidas</p>
            <div className="grid grid-cols-7 gap-2">
              {st.rewatch.filter((r) => r.id && fichas?.[String(r.id)]?.p).slice(0, 14).map((r) => (
                <button key={r.t} onClick={() => r.id && onFicha(r.id)} className="relative rounded-lg overflow-hidden border border-hairline hover:border-marquee transition-colors" title={`${r.t} · ${r.n} veces`}>
                  <img src={poster(fichas![String(r.id)].p, 154)!} alt={r.t} loading="lazy" className="w-full aspect-[2/3] object-cover"  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-stage/85 text-marquee rounded px-1.5 py-0.5">×{r.n}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {[["Tus directores", st.top_directores], ["Tus actores", st.top_actores], ["Tus géneros", st.top_generos]].map(([titulo, lista]) => (
            <Card key={titulo as string}>
              <p className="kicker mb-4" style={{ fontSize: 10 }}>{titulo as string}</p>
              {(lista as { n: string; c: number }[]).slice(0, 9).map((d, i) => (
                <div key={d.n} className="flex items-center gap-3 py-1.5">
                  <span className="text-faint text-xs w-4 text-right">{i + 1}</span>
                  {(d as { p?: string | null }).p
                    ? <img src={poster((d as { p?: string | null }).p!, 92)!} alt="" className="h-8 w-8 rounded-full object-cover border border-hairline"  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    : <span className="h-8 w-8 rounded-full bg-stage border border-hairline grid place-items-center text-[10px] text-faint">{d.n[0]}</span>}
                  <span className="flex-1 text-sm truncate">{d.n}</span>
                  <span className="h-1.5 rounded-full bg-marquee/70" style={{ width: `${(d.c / (lista as { c: number }[])[0].c) * 90}px` }} />
                  <span className="text-xs text-faint w-7 text-right">{d.c}</span>
                </div>
              ))}
            </Card>
          ))}
        </div>
        <Item className="mt-8 text-sm text-faint max-w-3xl">
          Tus 70 películas puntuadas y tus listas (Mindfuck, Time loops, la línea temporal del MCU) también viven en los datos:
          alimentan el modelo del capítulo «La fórmula de tu gusto».
        </Item>
      </Bloque>
    </div>
  );
}
