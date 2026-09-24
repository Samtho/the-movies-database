import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vaciarCacheDeDatos } from "./data";
import { useDatos } from "./useDatos";

const ok = (cuerpo: unknown) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200 }));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vaciarCacheDeDatos();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("useDatos", () => {
  it("empieza cargando y termina con los datos en el orden pedido", async () => {
    fetchMock.mockImplementation((url: string) => ok(url.includes("fichas") ? { f: 1 } : { s: 2 }));
    const { result } = renderHook(() => useDatos(["fichas", "similares"] as const));
    expect(result.current.estado).toBe("cargando");
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    if (result.current.estado !== "listo") throw new Error("inalcanzable");
    expect(result.current.datos).toEqual([{ f: 1 }, { s: 2 }]);
  });

  it("si falla cualquiera de los archivos, el estado es error", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("similares") ? Promise.resolve(new Response("x", { status: 404 })) : ok({}));
    const { result } = renderHook(() => useDatos(["fichas", "similares"] as const));
    await waitFor(() => expect(result.current.estado).toBe("error"));
    if (result.current.estado !== "error") throw new Error("inalcanzable");
    expect(result.current.error.archivo).toBe("similares");
  });

  it("reintentar vuelve a cargar y puede terminar bien", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 500 })).mockImplementation(() => ok({ bien: true }));
    const { result } = renderHook(() => useDatos(["fichas"] as const));
    await waitFor(() => expect(result.current.estado).toBe("error"));
    act(() => result.current.reintentar());
    expect(result.current.estado).toBe("cargando");
    await waitFor(() => expect(result.current.estado).toBe("listo"));
  });

  it("al cambiar de archivos no muestra datos del archivo anterior", async () => {
    let resolverB: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url.includes("fichas") ? ok({ a: 1 }) : new Promise<Response>((r) => { resolverB = r; }));
    const { result, rerender } = renderHook(({ n }) => useDatos(n), { initialProps: { n: ["fichas"] as readonly ("fichas" | "similares")[] } });
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    rerender({ n: ["similares"] });
    expect(result.current.estado).toBe("cargando");
    await act(async () => resolverB(new Response(JSON.stringify({ b: 2 }))));
    await waitFor(() => expect(result.current.estado).toBe("listo"));
    if (result.current.estado !== "listo") throw new Error("inalcanzable");
    expect(result.current.datos).toEqual([{ b: 2 }]);
  });
});
