import { useEffect, useState } from "react";
import { carga, gen_es } from "../lib/data";
import { Bloque, Card, CountUp, Item } from "../lib/ui";

type Gusto = {
  benchmark: Record<string, { auc: number; std: number }>;
  auc_amplio: [number, number];
  coefs: { f: string; w: number }[];
  backtest?: { corte: string; n_test: number; mediana_pct: number; top10: number; top20: number; p100: number; azar100: number };
  segunda_etapa?: { activa: boolean; notas: number; umbral: number };
};

// La fórmula de tu gusto: el torneo de modelos y los coeficientes interpretables del ganador.
export default function Formula() {
  const [g, setG] = useState<Gusto | null>(null);
  useEffect(() => { carga<Gusto>("gusto").then(setG); }, []);
  if (!g) return <p className="text-center text-faint py-20">Cargando el modelo…</p>;
  const bench = Object.entries(g.benchmark).sort((a, b) => b[1].auc - a[1].auc);
  const maxAuc = bench[0][1].auc;
  const coefs = g.coefs.map((c) => ({ ...c, f: c.f.startsWith("Género: ") ? "Género: " + gen_es(c.f.slice(8)) : c.f }));
  const maxW = Math.max(...coefs.map((c) => Math.abs(c.w)));
  return (
    <Bloque kicker="Capítulo 5 · la fórmula de tu gusto"
      titulo={<>Nueve modelos compitieron por entenderte.<br /><span className="text-marquee">Ganó el más simple.</span></>}
      intro="Entrenados con tus 1.116 vistas (señal implícita) contra el universo de películas visibles que no elegiste. La sorpresa: la regresión logística bate a los ensembles. Con ~1.000 positivos, lo simple y bien regularizado gana. Y de regalo, sus coeficientes se leen.">
      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <Card>
          <p className="kicker mb-4" style={{ fontSize: 10 }}>El torneo (AUC, validación cruzada 5-fold)</p>
          {bench.map(([n, v], i) => (
            <div key={n} className="flex items-center gap-3 py-1.5">
              <span className={`flex-1 text-sm truncate ${i === 0 ? "font-bold text-marquee" : "text-ivory-dim"}`}>{n}</span>
              <div className="w-44 md:w-56 h-4 rounded bg-hairline/60 overflow-hidden">
                <div className={`h-full rounded ${i === 0 ? "bg-marquee" : "bg-[#4a4a55]"}`} style={{ width: `${((v.auc - 0.5) / (maxAuc - 0.5)) * 100}%` }} />
              </div>
              <span className={`text-sm tabular-nums w-12 text-right ${i === 0 ? "text-marquee font-bold" : "text-faint"}`}>{v.auc.toLocaleString("es-ES")}</span>
            </div>
          ))}
          <p className="text-xs text-faint mt-4">Benchmark sobre el universo estricto (películas muy visibles). En el universo amplio de recomendación, la ganadora sube a:</p>
          <div className="mt-2 flex items-baseline gap-3">
            <CountUp to={g.auc_amplio[0]} decimals={3} className="font-display text-6xl font-semibold text-marquee" />
            <span className="text-sm text-faint">AUC ± {g.auc_amplio[1].toLocaleString("es-ES", { maximumFractionDigits: 3 })}</span>
          </div>
        </Card>
        <Card>
          <p className="kicker mb-4" style={{ fontSize: 10 }}>Lo que suma y lo que resta en tu gusto (coeficientes)</p>
          {coefs.slice(0, 14).map((c) => (
            <div key={c.f} className="flex items-center gap-3 py-1" title={c.w.toString()}>
              <span className="flex-1 text-sm truncate text-ivory-dim">{c.f}</span>
              <div className="w-48 md:w-60 h-3.5 relative">
                <div className="absolute inset-y-0 left-1/2 w-px bg-faint/50" />
                <div className={`absolute inset-y-0 rounded ${c.w >= 0 ? "bg-leaf left-1/2" : "bg-blood right-1/2"}`}
                  style={{ width: `${(Math.abs(c.w) / maxW) * 50}%` }} />
              </div>
              <span className={`text-xs tabular-nums w-12 text-right ${c.w >= 0 ? "text-leaf" : "text-blood"}`}>{c.w > 0 ? "+" : ""}{c.w.toLocaleString("es-ES")}</span>
            </div>
          ))}
        </Card>
      </div>
      {g.backtest && (
        <div className="mt-6 grid lg:grid-cols-2 gap-6">
          <Card className="!border-marquee/40">
            <p className="kicker mb-3" style={{ fontSize: 10 }}>La prueba del algodón (backtest temporal, sin trampa)</p>
            <p className="text-sm text-ivory-dim leading-relaxed">
              Entrenamos el modelo solo con lo que habías visto <strong className="text-ivory">antes de {g.backtest.corte.slice(0, 4)}</strong> y
              comprobamos contra las {g.backtest.n_test} películas que viste después:
            </p>
            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
              <div><CountUp to={g.backtest.p100} className="font-display text-6xl font-semibold text-marquee" /><div className="text-xs text-faint mt-1">de su top-100 acabaste viéndolas<br />(el azar serían ~{Math.round(g.backtest.azar100 * 100) / 100 < 3 ? 3 : g.backtest.azar100})</div></div>
              <div><CountUp to={g.backtest.top10} suffix="%" className="font-display text-6xl font-semibold" /><div className="text-xs text-faint mt-1">de tus vistas futuras estaban<br />en su top-10%</div></div>
              <div><span className="font-display text-6xl font-semibold">top {g.backtest.mediana_pct.toLocaleString("es-ES")}%</span><div className="text-xs text-faint mt-1">percentil mediano de tus<br />vistas futuras en el ranking</div></div>
            </div>
          </Card>
          <Card>
            <p className="kicker mb-3" style={{ fontSize: 10 }}>Cómo se refuerza a partir de ahora</p>
            <ul className="text-sm text-ivory-dim leading-relaxed space-y-2.5">
              <li><strong className="text-ivory">1 · Puntúa lo que veas en Trakt</strong> (del 1 al 10, dos segundos). Las notas bajas valen oro: hoy el modelo no sabe qué viste y no te gustó.</li>
              <li><strong className="text-ivory">2 · Re-exporta cuando quieras.</strong> El actualizador re-cruza, pide a TMDB solo lo nuevo y reentrena con tus vistas recientes.</li>
              <li><strong className="text-ivory">3 · A las {g.segunda_etapa?.umbral ?? 150} notas</strong> se activa sola la segunda etapa: P(gustarte | verla), y el score pasa a mezclar elección y disfrute.
                {g.segunda_etapa && <span className="text-marquee"> Llevas {g.segunda_etapa.notas}.</span>}</li>
            </ul>
          </Card>
        </div>
      )}
      <Item className="mt-7 text-sm text-faint max-w-3xl leading-relaxed">
        Honestidad metodológica: la señal es implícita (haber visto ≠ haber disfrutado; tus 70 notas explícitas son pocas para
        entrenar solas), el dataset llega a 2017 y la popularidad es parte del modelo (ves lo que es visible). Aun así, un AUC
        de 0,9 significa que, ante dos películas al azar, el modelo acierta 9 de cada 10 veces cuál verías tú.
      </Item>
    </Bloque>
  );
}
