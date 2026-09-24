import { useEffect, useRef } from "react";
// ECharts modular: solo los gráficos y componentes que usa la app (el paquete completo
// eran ~380 KB comprimidos). Un tipo nuevo de gráfico hay que registrarlo aquí.
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, HeatmapChart, LineChart, ScatterChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

type Props = {
  option: echarts.EChartsCoreOption;
  className?: string;
  height?: number | string;
  etiqueta: string; // descripción accesible del gráfico
};

// Envoltorio de ECharts: inicializa, actualiza opciones y se redimensiona con su contenedor.
export default function EChart({ option, className, height = 420, etiqueta }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const instance = echarts.init(el.current, undefined, { renderer: "canvas" });
    chart.current = instance;
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    // animation:false: gráficos fijos, sin re-animación en cada cambio de filtro
    chart.current?.setOption({ ...(option as Record<string, unknown>), animation: false }, true);
  }, [option]);

  return <div ref={el} role="img" aria-label={etiqueta} className={className} style={{ width: "100%", height }} />;
}
