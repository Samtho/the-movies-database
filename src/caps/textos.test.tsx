import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gusto, servirDatos, stats } from "../test/fixtures";
import Formula from "./Formula";
import Industria from "./Industria";
import Marquesina from "./Marquesina";
import Vida from "./Vida";

// 6A: ninguna cifra del historial o del modelo está escrita a mano en la UI.
// Con datos distintos a los reales, el texto debe cambiar con ellos.
vi.mock("../components/EChart", () => ({ default: ({ etiqueta }: { etiqueta: string }) => <div role="img" aria-label={etiqueta} /> }));
afterEach(() => vi.unstubAllGlobals());

describe("Formula", () => {
  it("cuenta de modelos, vistas, azar, notas y AUC salen de los datos", async () => {
    servirDatos({
      gusto: gusto({
        benchmark: { "Regresión logística": { auc: 0.8, std: 0 }, A: { auc: 0.7, std: 0 }, B: { auc: 0.6, std: 0 } },
        auc_cv: [0.83, 0.02],
        backtest: { ...gusto().backtest, azar100: 2.5, n_test: 321, top10: 61, techo: { mediana_pct: 2, top10: 79, top20: 90, p100: 73 } },
        segunda_etapa: { activa: false, notas: 7, notas_totales: 70, umbral: 150 },
      }),
      stats: stats({ match_dataset: 42 }),
    });
    render(<Formula />);
    expect(await screen.findByText(/Tres modelos compitieron/)).toBeInTheDocument();
    expect(screen.getByText("Ganó el más simple.")).toBeInTheDocument();
    expect(screen.getByText(/tus 42 vistas/)).toBeInTheDocument();
    expect(screen.getByText(/las 321 películas que descubriste después/)).toBeInTheDocument();
    expect(screen.getByText(/sube a 79% en el top-10% y 73 de/)).toBeInTheDocument(); // techo explicado
    expect(screen.getByText(/al azar serían ~2,5/)).toBeInTheDocument(); // antes mostraba "~3"
    expect(screen.getByText(/Llevas 7 que cuentan/)).toBeInTheDocument();
    expect(screen.getByText(/de tus 70 notas; las de películas posteriores a 2017/)).toBeInTheDocument();
    expect(screen.getByText(/acierta 8 de cada 10 veces/)).toBeInTheDocument();
  });

  it("si gana otro modelo, el titular lo dice", async () => {
    servirDatos({ gusto: gusto({ benchmark: { "Random Forest": { auc: 0.9, std: 0 }, "Regresión logística": { auc: 0.8, std: 0 } } }), stats: stats() });
    render(<Formula />);
    expect(await screen.findByText("Ganó Random Forest.")).toBeInTheDocument();
    expect(screen.queryByText(/bate a los ensembles/)).not.toBeInTheDocument();
  });

  it("sin benchmark ni coeficientes no revienta", async () => {
    servirDatos({ gusto: gusto({ benchmark: {}, coefs: [] }), stats: stats() });
    render(<Formula />);
    expect(await screen.findByText("Sin resultados todavía.")).toBeInTheDocument();
    expect(screen.getByText(/No hay coeficientes/)).toBeInTheDocument();
  });

  it("con la segunda etapa activa lo indica", async () => {
    servirDatos({ gusto: gusto({ segunda_etapa: { activa: true, notas: 200, notas_totales: 210, umbral: 150 } }), stats: stats() });
    render(<Formula />);
    expect(await screen.findByText(/Ya está activa\./)).toBeInTheDocument();
  });
});

describe("Marquesina", () => {
  it("universo y contadores desde stats", async () => {
    servirDatos({ stats: stats({ resumen: { universo: 123, auc: 0.9, auc_std: 0.01, modelos: 2 }, rewatch: [{ t: "Jaws", a: 1975, n: 4, id: 578, p: null }] }) });
    render(<Marquesina onFicha={() => {}} irA={() => {}} />);
    expect(await screen.findByText(/cruzado con 123 películas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jaws" })).toBeInTheDocument();
    expect(screen.getByText(/\(4 veces\)/)).toBeInTheDocument();
  });

  it("sin repetidas no muestra la línea de la más repetida", async () => {
    servirDatos({ stats: stats({ rewatch: [] }) });
    render(<Marquesina onFicha={() => {}} irA={() => {}} />);
    await screen.findByText(/cruzado con/);
    expect(screen.queryByText(/Tu película más repetida/)).not.toBeInTheDocument();
  });
});

describe("Vida", () => {
  it("visionados, posteriores a 2017 y puntuadas desde stats", async () => {
    servirDatos({ stats: stats({ plays: 77, horas_registradas: 30, post2017: 9, ratings: [{ t: "A", r: 8, id: 1 }, { t: "B", r: 3, id: 2 }] }) });
    render(<Vida onFicha={() => {}} />);
    expect(await screen.findByText(/tus 77 visionados/)).toBeInTheDocument();
    expect(screen.getByText(/30 de 77 visionados tienen hora registrada/)).toBeInTheDocument();
    expect(screen.getByText(/Las 9 películas posteriores a 2017/)).toBeInTheDocument();
    expect(screen.getByText(/Tus 2 películas puntuadas/)).toBeInTheDocument();
  });

  it("listas vacías: mensajes en vez de divisiones por cero", async () => {
    servirDatos({ stats: stats() });
    render(<Vida onFicha={() => {}} />);
    expect(await screen.findByText(/Aún no has repetido/)).toBeInTheDocument();
    expect(screen.getAllByText("Sin datos todavía.")).toHaveLength(3);
  });
});

describe("Industria", () => {
  it("nº de puntos dibujados y universo desde los datos", async () => {
    servirDatos({
      industria: { serie: [{ y: 2000, g: "Drama", n: 60, va: 7, rev: 0 }], scatter: [[1, "A", 2000, 10, 20, 7], [2, "B", 2001, 0, 5, 6]] },
      stats: stats({ resumen: { universo: 4567, auc: 0.9, auc_std: 0.01, modelos: 2 } }),
    });
    render(<Industria onFicha={() => {}} />);
    expect(await screen.findByText(/\(1 con presupuesto y taquilla conocidos\)/)).toBeInTheDocument();
    expect(screen.getByText(/4\.567 películas con año de estreno/)).toBeInTheDocument();
  });
});
