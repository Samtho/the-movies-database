import { EstadoCarga } from "../components/EstadoCarga";
import { Bloque, Card, CountUp, Item } from "../components/ui";
import { anchoAuc, coefsLegibles, esModeloSimple, ordenarBenchmark, pesoMaximo } from "../lib/formula";
import { formatoNumero, numeroEnPalabras } from "../lib/format";
import { proporcion } from "../lib/numeros";
import { useDatos } from "../lib/useDatos";

// La fórmula de tu gusto: el torneo de modelos y los coeficientes interpretables del ganador.
export default function Formula() {
  const r = useDatos(["gusto", "stats"] as const);
  if (r.estado !== "listo") {
    return <Bloque kicker="Capítulo 5 · la fórmula de tu gusto"><EstadoCarga estado={r} texto="Cargando el modelo…" onReintentar={r.reintentar} /></Bloque>;
  }
  const [g, stats] = r.datos;
  const bench = ordenarBenchmark(g.benchmark);
  const ganador = bench[0];
  const coefs = coefsLegibles(g.coefs);
  const maxW = pesoMaximo(coefs);
  const [auc, aucStd] = g.auc_cv;
  const bt = g.backtest;
  const etapa = g.segunda_etapa;
  const simpleGana = esModeloSimple(ganador?.nombre);

  return (
    <Bloque kicker="Capítulo 5 · la fórmula de tu gusto"
      titulo={<>{numeroEnPalabras(bench.length, { mayuscula: true })} modelos compitieron por entenderte.<br />
        <span className="text-marquee">{!ganador ? "Sin resultados todavía." : simpleGana ? "Ganó el más simple." : `Ganó ${ganador.nombre}.`}</span></>}
      intro={simpleGana
        ? <>Entrenados con tus {formatoNumero(stats.match_dataset)} vistas (señal implícita) contra el universo de películas visibles que no
          elegiste. La sorpresa: la regresión logística bate a los ensembles. Con {formatoNumero(stats.match_dataset)} positivos, lo simple
          y bien regularizado gana. Y de regalo, sus coeficientes se leen.</>
        : <>Entrenados con tus {formatoNumero(stats.match_dataset)} vistas (señal implícita) contra el universo de películas visibles que no
          elegiste.</>}>
      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <Card titulo="El torneo (AUC, validación cruzada 5-fold)">
          {bench.length === 0 && <p className="text-sm text-faint">No hay resultados del torneo en los datos.</p>}
          {bench.map((m, i) => (
            <div key={m.nombre} className="flex items-center gap-3 py-1.5">
              <span className={`flex-1 text-sm truncate ${i === 0 ? "font-bold text-marquee" : "text-ivory-dim"}`}>{m.nombre}</span>
              <div className="w-44 md:w-56 h-4 rounded bg-hairline/60 overflow-hidden">
                <div className={`h-full rounded ${i === 0 ? "bg-marquee" : "bg-[#4a4a55]"}`} style={{ width: `${anchoAuc(m.auc, ganador.auc) * 100}%` }} />
              </div>
              <span className={`text-sm tabular-nums w-12 text-right ${i === 0 ? "text-marquee font-bold" : "text-faint"}`}>{formatoNumero(m.auc, 3)}</span>
            </div>
          ))}
          <p className="text-xs text-faint mt-4">Torneo de julio de 2026 sobre las películas muy visibles (100 votos o más). El modelo en producción, con las variables de texto y reentrenado en cada refresco, obtiene en ese mismo universo:</p>
          <div className="mt-2 flex items-baseline gap-3">
            <CountUp to={auc} decimals={3} className="font-display text-6xl font-semibold text-marquee" />
            <span className="text-sm text-faint">AUC ± {formatoNumero(aucStd, 3)}</span>
          </div>
        </Card>
        <Card titulo="Lo que suma y lo que resta en tu gusto (coeficientes)">
          {coefs.length === 0 && <p className="text-sm text-faint">No hay coeficientes en los datos.</p>}
          {coefs.map((c) => (
            <div key={c.f} className="flex items-center gap-3 py-1" title={String(c.w)}>
              <span className="flex-1 text-sm truncate text-ivory-dim">{c.f}</span>
              <div className="w-48 md:w-60 h-3.5 relative">
                <div className="absolute inset-y-0 left-1/2 w-px bg-faint/50" />
                <div className={`absolute inset-y-0 rounded ${c.w >= 0 ? "bg-leaf left-1/2" : "bg-blood right-1/2"}`}
                  style={{ width: `${proporcion(Math.abs(c.w), maxW) * 50}%` }} />
              </div>
              <span className={`text-xs tabular-nums w-12 text-right ${c.w >= 0 ? "text-leaf" : "text-blood"}`}>{c.w > 0 ? "+" : ""}{formatoNumero(c.w, 3)}</span>
            </div>
          ))}
        </Card>
      </div>
      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <Card className="!border-marquee/40" titulo="La prueba del algodón (backtest temporal, versión conservadora)">
          <p className="text-sm text-ivory-dim leading-relaxed">
            Entrenamos el modelo solo con lo que habías visto <strong className="text-ivory">antes de {bt.corte.slice(0, 4)}</strong> y
            comprobamos contra las {formatoNumero(bt.n_test)} películas que descubriste después:
          </p>
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
            <div><CountUp to={bt.p100} className="font-display text-6xl font-semibold text-marquee" /><div className="text-xs text-faint mt-1">de su top-100 acabaste viéndolas<br />(al azar serían ~{formatoNumero(bt.azar100, 1)})</div></div>
            <div><CountUp to={bt.top10} suffix="%" className="font-display text-6xl font-semibold" /><div className="text-xs text-faint mt-1">de tus descubrimientos estaban<br />en su top-10%</div></div>
            <div><span className="font-display text-6xl font-semibold">top {formatoNumero(bt.mediana_pct, 1)}%</span><div className="text-xs text-faint mt-1">percentil mediano de tus<br />descubrimientos en el ranking</div></div>
          </div>
          <p className="text-xs text-faint mt-5 leading-relaxed">
            Conservadora porque no usa votos ni popularidad: el dataset los midió en 2017, después del corte, y usarlos sería
            mirar el futuro. Con ellos el resultado sube a {formatoNumero(bt.techo.top10)}% en el top-10% y {formatoNumero(bt.techo.p100)} de
            100: ese es el techo. La cifra real está entre ambas.
            {bt.n_sin_fecha > 0 && <> Quedan fuera {formatoNumero(bt.n_sin_fecha)} películas que registraste sin fecha real,
              porque no se sabe si las viste antes o después de {bt.corte.slice(0, 4)}.</>}
          </p>
        </Card>
        <Card titulo="Cómo se refuerza a partir de ahora">
          <ul className="text-sm text-ivory-dim leading-relaxed space-y-2.5">
            <li><strong className="text-ivory">1 · Puntúa lo que veas en Trakt</strong> (del 1 al 10, dos segundos). Las notas bajas valen oro: hoy el modelo no sabe qué viste y no te gustó.</li>
            <li><strong className="text-ivory">2 · Re-exporta cuando quieras.</strong> El actualizador re-cruza, pide a TMDB solo lo nuevo y reentrena con tus vistas recientes.</li>
            <li><strong className="text-ivory">3 · A las {formatoNumero(etapa.umbral)} notas</strong> se activa sola la segunda etapa: P(gustarte | verla), y el score pasa a mezclar elección y disfrute.
              <span className="text-marquee"> {etapa.activa ? "Ya está activa." : `Llevas ${formatoNumero(etapa.notas)} que cuentan`}</span>
              {!etapa.activa && etapa.notas_totales > etapa.notas && (
                <span className="text-faint"> (de tus {formatoNumero(etapa.notas_totales)} notas; las de películas posteriores a 2017 aún no sirven al modelo)</span>
              )}
              {!etapa.activa && <span className="text-marquee">.</span>}</li>
          </ul>
        </Card>
      </div>
      <Item className="mt-7 text-sm text-faint max-w-3xl leading-relaxed">
        Honestidad metodológica: la señal es implícita (haber visto no es haber disfrutado; tus {formatoNumero(etapa.notas_totales)} notas
        explícitas son pocas para entrenar solas), el dataset llega a 2017 y la popularidad es parte del modelo (ves lo que es visible).
        Aun así, un AUC de {formatoNumero(auc, 1)} significa que, ante dos películas al azar, el modelo acierta
        {" "}{Math.round(auc * 10)} de cada 10 veces cuál verías tú.
      </Item>
    </Bloque>
  );
}
