import { useMemo, useState } from "react";
import { Chip } from "../components/Chip";
import EChart from "../components/EChart";
import { EstadoCarga } from "../components/EstadoCarga";
import { Bloque, Card, Item } from "../components/ui";
import { formatoNumero } from "../lib/format";
import { generoEs } from "../lib/generos";
import { generosPrincipales, notaMediaPorGenero, produccionPorAnio, puntosInversion } from "../lib/industria";
import { COLOR, EJE, TOOLTIP } from "../lib/theme";
import { useDatos } from "../lib/useDatos";

const DESDE = [1930, 1960, 1980, 2000];
const CLASICO_FINAL = 597; // Titanic: guiño editorial al cierre del capítulo

// La industria: el EDA de la propuesta original, filtrable en vivo.
export default function Industria({ onFicha }: { onFicha: (id: number) => void }) {
  const r = useDatos(["industria", "stats"] as const);
  const [desde, setDesde] = useState(1960);
  const [genero, setGenero] = useState<string | null>(null);
  const datos = r.estado === "listo" ? r.datos : null;
  const serie = datos?.[0].serie;

  const generos = useMemo(() => (serie ? generosPrincipales(serie) : []), [serie]);
  const produccion = useMemo(() => (serie ? produccionPorAnio(serie, desde, genero) : []), [serie, desde, genero]);
  const notas = useMemo(() => (serie ? notaMediaPorGenero(serie, desde) : []), [serie, desde]);
  const puntos = useMemo(() => (datos ? puntosInversion(datos[0].scatter) : []), [datos]);

  const prodOpt = useMemo(() => ({
    grid: { left: 55, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: produccion.map((p) => p.anio), ...EJE, splitLine: { show: false } },
    yAxis: { type: "value", ...EJE },
    series: [{ type: "line", smooth: true, symbol: "none", data: produccion.map((p) => p.n), lineStyle: { color: COLOR.marquee, width: 3 }, areaStyle: { color: "rgba(240,180,41,0.12)" } }],
    tooltip: { trigger: "axis", ...TOOLTIP },
  }), [produccion]);
  const notasOpt = useMemo(() => ({
    grid: { left: 120, right: 40, top: 10, bottom: 30 },
    xAxis: { type: "value", min: 5, ...EJE },
    yAxis: { type: "category", data: notas.map((x) => generoEs(x.g)).reverse(), ...EJE, axisLabel: { color: COLOR.ivoryDim }, splitLine: { show: false } },
    series: [{ type: "bar", data: notas.map((x) => Number(x.nota.toFixed(2))).reverse(), itemStyle: { color: COLOR.blood, borderRadius: [0, 3, 3, 0] }, label: { show: true, position: "right", color: COLOR.faint } }],
  }), [notas]);
  const scatterOpt = useMemo(() => ({
    grid: { left: 65, right: 25, top: 20, bottom: 45 },
    xAxis: { type: "log", name: "presupuesto (M$)", nameTextStyle: { color: COLOR.faint }, ...EJE },
    yAxis: { type: "log", name: "taquilla (M$)", nameTextStyle: { color: COLOR.faint }, ...EJE },
    series: [
      { type: "scatter", symbolSize: 4, data: puntos.map((p) => ({ value: p.value, name: p.nombre })), itemStyle: { color: "rgba(240,180,41,0.45)" } },
      { type: "line", data: [[1, 1], [400, 400]], symbol: "none", lineStyle: { color: COLOR.blood, type: "dashed", width: 1.5 }, tooltip: { show: false } },
    ],
    tooltip: { formatter: (p: { name: string }) => p.name, ...TOOLTIP },
  }), [puntos]);

  if (!datos) {
    return <Bloque kicker="Capítulo 6 · la industria (el encargo original)"><EstadoCarga estado={r} texto="Cargando la industria…" onReintentar={r.reintentar} /></Bloque>;
  }
  const universo = datos[1].resumen.universo;

  return (
    <Bloque kicker="Capítulo 6 · la industria (el encargo original)"
      titulo={<>Un siglo de cine, <span className="text-marquee">filtrable</span>.</>}
      intro="El EDA que pedía la propuesta del TFM: producción por año, nota media por género y la eterna pregunta de si el dinero compra taquilla. Datos hasta 2017 (donde termina el dataset).">
      <Item className="mt-6 flex flex-wrap items-center gap-2">
        {DESDE.map((a) => <Chip key={a} activo={desde === a} onClick={() => setDesde(a)}>desde {a}</Chip>)}
        <span className="w-3" />
        {generos.map((g) => (
          <Chip key={g} variante="contorno" activo={genero === g} onClick={() => setGenero(genero === g ? null : g)}>{generoEs(g)}</Chip>
        ))}
      </Item>
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card titulo={`Películas estrenadas por año${genero ? ` · ${generoEs(genero)}` : ""}`}>
          {produccion.length === 0 ? <p className="text-sm text-faint">Sin estrenos para este filtro.</p>
            : <EChart option={prodOpt} height={280} etiqueta="Películas estrenadas por año" />}
        </Card>
        <Card titulo={`Nota media por género (desde ${desde})`}>
          {notas.length === 0 ? <p className="text-sm text-faint">Ningún género alcanza el mínimo de películas para este periodo.</p>
            : <EChart option={notasOpt} height={280} etiqueta="Nota media por género" />}
        </Card>
      </div>
      <Card className="mt-6" titulo={`¿El presupuesto compra taquilla? Cada punto, una película (${formatoNumero(puntos.length)} con presupuesto y taquilla conocidos) · la diagonal = recuperar lo invertido`}>
        <EChart option={scatterOpt} height={420} etiqueta="Presupuesto frente a taquilla por película" />
      </Card>
      <Item className="mt-8 text-sm text-faint max-w-3xl">
        Nota metodológica: fuente The Movies Dataset (Kaggle · TMDB + MovieLens), {formatoNumero(universo)} películas con año de estreno,
        sin ajuste de inflación. Pipeline en Python: limpieza, cruce con Trakt, TF-IDF + SVD + UMAP, modelo logístico exportado.
        <button type="button" className="text-marquee hover:underline ml-1" onClick={() => onFicha(CLASICO_FINAL)}>¿Un clásico para terminar?</button>
      </Item>
    </Bloque>
  );
}
