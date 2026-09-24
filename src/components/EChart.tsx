import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type Props = {
  option: echarts.EChartsCoreOption;
  className?: string;
  height?: number | string;
};

// Envoltorio de ECharts: inicializa, actualiza opciones y se redimensiona.
export default function EChart({ option, className, height = 420 }: Props) {
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
    // animation:false -> gráficos fijos (evita la re-animación rara en cada render)
    chart.current?.setOption({ ...(option as Record<string, unknown>), animation: false }, true);
  }, [option]);

  return <div ref={el} className={className} style={{ width: "100%", height }} />;
}
