import { useEffect, useMemo, useState } from "react";
import { carga, gen_es } from "../lib/data";
import { Bloque, Card, Item } from "../lib/ui";
import EChart from "../components/EChart";

type Industria = { serie: { y: number; g: string; n: number; va: number; rev: number }[]; scatter: [number, string, number, number, number, number][] };
const C = { ink: "#f2ede1", dim: "#b6b0a2", faint: "#6e695e", line: "#26262e", amber: "#f0b429", blood: "#e0563f" };

// La industria: el EDA de la propuesta original, filtrable en vivo.
export default function Industria({ onFicha }: { onFicha: (id: number) => void }) {
  const [d, setD] = useState<Industria | null>(null);
  const [desde, setDesde] = useState(1960);
  const [genero, setGenero] = useState<string | null>(null);
  useEffect(() => { carga<Industria>("industria").then(setD); }, []);

  const generos = useMemo(() => {
    if (!d) return [];
    const c = new Map<string, number>();
    for (const r of d.serie) c.set(r.g, (c.get(r.g) ?? 0) + r.n);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g]) => g);
  }, [d]);

  if (!d) return <p className="text-center text-faint py-20">Cargando la industria…</p>;
  const serie = d.serie.filter((r) => r.y >= desde && (!genero || r.g === genero));
  const porAnio = new Map<number, { n: number; rev: number }>();
  for (const r of serie) {
    const cur = porAnio.get(r.y) ?? { n: 0, rev: 0 };
    porAnio.set(r.y, { n: cur.n + r.n, rev: cur.rev + r.rev });
  }
  const anios = [...porAnio.keys()].sort();
  const porGenero = new Map<string, { n: number; va: number }>();
  for (const r of d.serie.filter((r) => r.y >= desde)) {
    const cur = porGenero.get(r.g) ?? { n: 0, va: 0 };
    porGenero.set(r.g, { n: cur.n + r.n, va: cur.va + r.va * r.n });
  }
  const notas = [...porGenero.entries()].map(([g, v]) => ({ g, nota: v.va / v.n, n: v.n }))
    .filter((x) => x.n > 50).sort((a, b) => b.nota - a.nota).slice(0, 12);

  const prodOpt = {
    grid: { left: 55, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: anios, axisLabel: { color: C.faint }, axisLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "value", axisLabel: { color: C.faint }, splitLine: { lineStyle: { color: C.line } } },
    series: [{ type: "line", smooth: true, symbol: "none", data: anios.map((a) => porAnio.get(a)!.n),
      lineStyle: { color: C.amber, width: 3 }, areaStyle: { color: "rgba(240,180,41,0.12)" } }],
    tooltip: { trigger: "axis", backgroundColor: "#141419", borderColor: C.line, textStyle: { color: C.ink } },
  };
  const notasOpt = {
    grid: { left: 120, right: 40, top: 10, bottom: 30 },
    xAxis: { type: "value", min: 5, axisLabel: { color: C.faint }, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "category", data: notas.map((x) => gen_es(x.g)).reverse(), axisLabel: { color: C.dim }, axisLine: { lineStyle: { color: C.line } } },
    series: [{ type: "bar", data: notas.map((x) => +x.nota.toFixed(2)).reverse(), itemStyle: { color: C.blood, borderRadius: [0, 3, 3, 0] }, label: { show: true, position: "right", color: C.faint } }],
  };
  const scatterOpt = {
    grid: { left: 65, right: 25, top: 20, bottom: 45 },
    xAxis: { type: "log", name: "presupuesto (M$)", nameTextStyle: { color: C.faint }, axisLabel: { color: C.faint }, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "log", name: "taquilla (M$)", nameTextStyle: { color: C.faint }, axisLabel: { color: C.faint }, splitLine: { lineStyle: { color: C.line } } },
    series: [{ type: "scatter", symbolSize: 4, data: d.scatter.filter((s) => s[3] > 0 && s[4] > 0).map((s) => ({ value: [s[3], s[4]], id: s[0], name: `${s[1]} (${s[2]})` })),
      itemStyle: { color: "rgba(240,180,41,0.45)" } },
      { type: "line", data: [[1, 1], [400, 400]], symbol: "none", lineStyle: { color: C.blood, type: "dashed", width: 1.5 }, tooltip: { show: false } }],
    tooltip: { formatter: (p: { name: string }) => p.name, backgroundColor: "#141419", borderColor: C.line, textStyle: { color: C.ink } },
  };

  return (
    <Bloque kicker="Capítulo 6 · la industria (el encargo original)"
      titulo={<>Un siglo de cine, <span className="text-marquee">filtrable</span>.</>}
      intro="El EDA que pedía la propuesta del TFM: producción por año, nota media por género y la eterna pregunta de si el dinero compra taquilla. Datos hasta 2017 (donde termina el dataset).">
      <Item className="mt-6 flex flex-wrap items-center gap-2">
        {[1930, 1960, 1980, 2000].map((a) => (
          <button key={a} onClick={() => setDesde(a)}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors ${desde === a ? "bg-marquee text-stage border-marquee font-bold" : "border-hairline text-ivory-dim hover:border-marquee"}`}>
            desde {a}
          </button>
        ))}
        <span className="w-3" />
        {generos.map((g) => (
          <button key={g} onClick={() => setGenero(genero === g ? null : g)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${genero === g ? "border-marquee text-marquee" : "border-hairline text-faint hover:text-ivory-dim"}`}>
            {gen_es(g)}
          </button>
        ))}
      </Item>
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card><p className="kicker mb-3" style={{ fontSize: 10 }}>Películas estrenadas por año{genero ? ` · ${gen_es(genero)}` : ""}</p><EChart option={prodOpt} height={280} /></Card>
        <Card><p className="kicker mb-3" style={{ fontSize: 10 }}>Nota media por género (desde {desde})</p><EChart option={notasOpt} height={280} /></Card>
      </div>
      <Card className="mt-6">
        <p className="kicker mb-3" style={{ fontSize: 10 }}>¿El presupuesto compra taquilla? Cada punto, una película (clic imposible aquí: 5.116 puntos) · la diagonal = recuperar lo invertido</p>
        <EChart option={scatterOpt} height={420} />
      </Card>
      <Item className="mt-8 text-sm text-faint max-w-3xl">
        Nota metodológica: fuente The Movies Dataset (Kaggle · TMDB + MovieLens), 45.433 películas tras limpieza, sin ajuste de inflación.
        Pipeline reproducible en Python: limpieza, cruce con Trakt, TF-IDF + SVD + UMAP, modelo logístico exportado.
        <button className="text-marquee hover:underline ml-1" onClick={() => onFicha(597)}>¿Un clásico para terminar?</button>
      </Item>
    </Bloque>
  );
}
