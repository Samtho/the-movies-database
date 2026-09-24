import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ErrorDeDatos } from "../lib/data";
import { Buscador } from "./Buscador";
import { Chip } from "./Chip";
import { EstadoCarga } from "./EstadoCarga";
import { Modal } from "./Modal";
import { Avatar, Poster } from "./Poster";

describe("Poster y Avatar", () => {
  it("sin ruta muestra el respaldo", () => {
    render(<Poster ruta={null} alt="x" respaldo={<span>sin póster</span>} />);
    expect(screen.getByText("sin póster")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("si la imagen falla, cambia al respaldo (nunca icono roto)", () => {
    render(<Poster ruta="/a.jpg" alt="Cartel" respaldo={<span>respaldo</span>} />);
    fireEvent.error(screen.getByRole("img", { name: "Cartel" }));
    expect(screen.getByText("respaldo")).toBeInTheDocument();
  });
  it("el avatar sin foto muestra la inicial", () => {
    render(<Avatar ruta={null} nombre="Agnès Varda" tamano="h-8 w-8" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });
  it("nombre vacío: interrogación, no cadena vacía", () => {
    render(<Avatar ruta={null} nombre="  " tamano="h-8 w-8" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

describe("Chip", () => {
  it("expone su estado con aria-pressed", async () => {
    const onClick = vi.fn();
    render(<Chip activo onClick={onClick}>Drama</Chip>);
    const b = screen.getByRole("button", { name: "Drama" });
    expect(b).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("EstadoCarga", () => {
  it("cargando: texto de estado", () => {
    render(<EstadoCarga estado={{ estado: "cargando" }} texto="Cargando…" onReintentar={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  });
  it("error: mensaje y reintento", async () => {
    const reintentar = vi.fn();
    render(<EstadoCarga estado={{ estado: "error", error: new ErrorDeDatos("stats", "http", "HTTP 503") }} texto="" onReintentar={reintentar} />);
    expect(screen.getByRole("alert")).toHaveTextContent("stats.json");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reintentar).toHaveBeenCalledOnce();
  });
});

describe("Buscador", () => {
  const frutas = ["Manzana", "Mandarina", "Mango"];
  const buscar = (q: string) => frutas.filter((f) => f.toLowerCase().includes(q.toLowerCase()));
  it("no busca con menos de 2 caracteres", async () => {
    render(<Buscador placeholder="Buscar" buscar={buscar} claveDe={(f) => f} render={(f) => f} onElegir={() => {}} />);
    await userEvent.type(screen.getByRole("combobox"), "m");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("flechas y Enter eligen con teclado; luego se limpia", async () => {
    const onElegir = vi.fn();
    render(<Buscador placeholder="Buscar" buscar={buscar} claveDe={(f) => f} render={(f) => f} onElegir={onElegir} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "man");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onElegir).toHaveBeenCalledWith("Mandarina");
    expect(input).toHaveValue("");
  });
  it("las flechas dan la vuelta", async () => {
    const onElegir = vi.fn();
    render(<Buscador placeholder="Buscar" buscar={buscar} claveDe={(f) => f} render={(f) => f} onElegir={onElegir} />);
    await userEvent.type(screen.getByRole("combobox"), "man");
    await userEvent.keyboard("{ArrowUp}{Enter}"); // desde el primero, arriba = el último
    expect(onElegir).toHaveBeenCalledWith("Mango");
  });
  it("Escape limpia la búsqueda", async () => {
    render(<Buscador placeholder="Buscar" buscar={buscar} claveDe={(f) => f} render={(f) => f} onElegir={() => {}} />);
    await userEvent.type(screen.getByRole("combobox"), "man{Escape}");
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
  it("sin resultados no abre la lista", async () => {
    render(<Buscador placeholder="Buscar" buscar={buscar} claveDe={(f) => f} render={(f) => f} onElegir={() => {}} />);
    await userEvent.type(screen.getByRole("combobox"), "zz");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Modal", () => {
  function DosModales() {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    return (
      <>
        <button type="button">fuera</button>
        <AnimatePresence>{a && <Modal key="a" titulo="Ficha" onClose={() => setA(false)} capa={95}><button type="button" onClick={() => setB(true)}>abrir persona</button></Modal>}</AnimatePresence>
        <AnimatePresence>{b && <Modal key="b" titulo="Persona" onClose={() => setB(false)} capa={97}><button type="button">dentro</button></Modal>}</AnimatePresence>
      </>
    );
  }

  it("es un diálogo con nombre accesible y botón Cerrar etiquetado", () => {
    render(<Modal titulo="Ficha de Jaws" onClose={() => {}} capa={95}><p>hola</p></Modal>);
    expect(screen.getByRole("dialog", { name: "Ficha de Jaws" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("Escape cierra solo el de arriba", async () => {
    render(<DosModales />);
    await userEvent.click(screen.getByRole("button", { name: "abrir persona" }));
    expect(screen.getByRole("dialog", { name: "Persona" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Persona" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Ficha" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Ficha" })).not.toBeInTheDocument());
  });

  it("recibe el foco al abrirse y Tab no se escapa del panel", async () => {
    render(<Modal titulo="Ficha" onClose={() => {}} capa={95}><button type="button">uno</button><button type="button">dos</button></Modal>);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await userEvent.tab(); // -> Cerrar
    await userEvent.tab(); // -> uno
    await userEvent.tab(); // -> dos
    await userEvent.tab(); // vuelve al primero
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "dos" })).toHaveFocus();
  });

  it("clic en el fondo cierra; clic en el panel no", async () => {
    const onClose = vi.fn();
    render(<Modal titulo="Ficha" onClose={onClose} capa={95}><p>contenido</p></Modal>);
    await userEvent.click(screen.getByText("contenido"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
