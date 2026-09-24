import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

// Caracterización de la navegación antes del refactor de la Fase 1.
beforeEach(() => {
  // sin red en tests unitarios: cualquier carga de datos queda pendiente
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  window.location.hash = "";
});

describe("App", () => {
  it("muestra la marca y las 6 secciones en la navegación", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /The Movies/ })).toBeInTheDocument();
    const nav = screen.getByRole("navigation");
    const secciones = within(nav).getAllByRole("button").map((b) => b.textContent);
    expect(secciones).toEqual(["Tu vida en cine", "La galaxia", "El grafo", "Esta noche", "Tu gusto (ML)", "La industria"]);
  });

  it("abre la sección indicada en el hash de la URL", () => {
    window.location.hash = "#formula";
    render(<App />);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("button", { name: "Tu gusto (ML)" })).toHaveClass("bg-marquee");
  });

  it("ignora un hash desconocido y abre la portada", () => {
    window.location.hash = "#no-existe";
    render(<App />);
    const nav = screen.getByRole("navigation");
    for (const b of within(nav).getAllByRole("button")) expect(b).not.toHaveClass("bg-marquee");
  });
});
