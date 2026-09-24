import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cargar, ErrorDeDatos, urlDe, urlImagen, vaciarCacheDeDatos } from "./data";

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vaciarCacheDeDatos();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("cargar", () => {
  it("pide la URL versionada del archivo", async () => {
    fetchMock.mockResolvedValue(respuesta({}));
    await cargar("fichas");
    expect(fetchMock).toHaveBeenCalledWith(urlDe("fichas"));
    expect(urlDe("fichas")).toMatch(/data\/fichas\.json\?v=[0-9a-f]{12}$/);
  });

  it("N peticiones simultáneas del mismo archivo comparten una sola descarga", async () => {
    fetchMock.mockResolvedValue(respuesta({ "1": {} }));
    const [a, b, c] = await Promise.all([cargar("fichas"), cargar("fichas"), cargar("fichas")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("archivos distintos se descargan por separado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(respuesta({})));
    await Promise.all([cargar("fichas"), cargar("similares")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["red", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["http", () => Promise.resolve(respuesta("no existe", 404))],
    ["http", () => Promise.resolve(respuesta("error", 500))],
    ["json", () => Promise.resolve(respuesta("{roto"))],
  ] as const)("falla con causa '%s' y un error tipado", async (causa, impl) => {
    fetchMock.mockImplementation(impl);
    const error = await cargar("fichas").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeDatos);
    expect(error).toMatchObject({ archivo: "fichas", causa });
  });

  it("un fallo no queda en caché: el siguiente intento vuelve a descargar", async () => {
    fetchMock.mockResolvedValueOnce(respuesta("error", 503)).mockResolvedValueOnce(respuesta({ ok: 1 }));
    await expect(cargar("fichas")).rejects.toBeInstanceOf(ErrorDeDatos);
    await expect(cargar("fichas")).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un éxito sí queda en caché", async () => {
    fetchMock.mockResolvedValue(respuesta({}));
    await cargar("fichas");
    await cargar("fichas");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["fichas", []], // se esperaba objeto
    ["fichas", null],
    ["fichas", 42],
    ["galaxia", {}], // se esperaba lista
  ] as const)("%s con tipo raíz inesperado (%j): causa 'esquema'", async (nombre, cuerpo) => {
    fetchMock.mockResolvedValue(respuesta(JSON.stringify(cuerpo)));
    await expect(cargar(nombre)).rejects.toMatchObject({ causa: "esquema", archivo: nombre });
  });

  it("acepta el tipo raíz correcto sin validar el contenido (eso se hace en CI)", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(respuesta(url.includes("galaxia") ? [] : { cualquier: "cosa" })));
    await expect(cargar("fichas")).resolves.toEqual({ cualquier: "cosa" });
    await expect(cargar("galaxia")).resolves.toEqual([]);
  });
});

describe("urlImagen", () => {
  it.each([
    ["/abc.jpg", 154, "https://image.tmdb.org/t/p/w154/abc.jpg"],
    ["/abc.jpg", 342, "https://image.tmdb.org/t/p/w342/abc.jpg"],
    [null, 154, null],
    [undefined, 92, null],
    ["", 92, null],
  ] as const)("%s w%s", (ruta, ancho, esperado) => expect(urlImagen(ruta, ancho)).toBe(esperado));
});
