import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FichaModal from "./FichaModal";
import PersonaModal from "./PersonaModal";
import { ficha, gusto, servirDatos } from "./test/fixtures";

// Issue 20: una película vista sin fecha (fecha desconocida en Trakt o carga en bloque)
// se muestra como vista, sin inventarse una fecha.
afterEach(() => vi.unstubAllGlobals());

const fichas = {
  "1": ficha({ t: "Con fecha", d: "Ana", v: 1 }),
  "2": ficha({ t: "Sin fecha", d: "Ana", v: 1 }),
  "3": ficha({ t: "No vista", d: "Ana", v: 0 }),
};
const vistas = { "1": { d: "2026-06-14", n: 1 }, "2": { d: null, n: 2 } };

function servir() {
  servirDatos({ fichas, vistas, similares: {}, gusto: gusto() });
}

describe("FichaModal", () => {
  it("vista con fecha: la fecha en formato es-ES", async () => {
    servir();
    render(<FichaModal id={1} onClose={() => {}} onOpen={() => {}} onPersona={() => {}} />);
    expect(await screen.findByText("LA VISTE el 14/06/2026")).toBeInTheDocument();
  });

  it("vista sin fecha: lo dice, con sus visionados", async () => {
    servir();
    render(<FichaModal id={2} onClose={() => {}} onOpen={() => {}} onPersona={() => {}} />);
    expect(await screen.findByText("LA VISTE sin fecha · 2 veces")).toBeInTheDocument();
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });

  it("no vista: sin etiqueta", async () => {
    servir();
    render(<FichaModal id={3} onClose={() => {}} onOpen={() => {}} onPersona={() => {}} />);
    await screen.findByText("No vista", { selector: "h3" });
    expect(screen.queryByText(/LA VISTE/)).not.toBeInTheDocument();
  });
});

describe("PersonaModal", () => {
  it("cada película vista con su fecha o 'sin fecha'; la última vista ignora las que no tienen", async () => {
    servir();
    render(<PersonaModal nombre="Ana" onClose={() => {}} onPeli={() => {}} />);
    expect(await screen.findByText(/vista el 14\/06\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/vista sin fecha/)).toBeInTheDocument();
    expect(screen.getByText(/la última el 14\/06\/2026/)).toBeInTheDocument();
  });
});
