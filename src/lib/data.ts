// Carga de los JSON precalculados (pipeline Python), con caché de promesas y errores tipados.
import type { Datos, NombreArchivo } from "./schema";

// El contrato completo (esquemas Zod) se valida en CI sobre los JSON reales
// (tests/data/contrato.test.ts): un archivo que no lo cumple no llega a publicarse.
// En el navegador solo se comprueba lo mínimo y barato: que el JSON sea del tipo
// esperado (lista u objeto). Meter Zod aquí costaría ~30 KB en la carga inicial.
const ES_LISTA: Readonly<Record<NombreArchivo, boolean>> = {
  fichas: false, galaxia: true, grafo: false, gusto: false,
  industria: false, similares: false, stats: false, vistas: false,
};

export type CausaError = "red" | "http" | "json" | "esquema";

export class ErrorDeDatos extends Error {
  readonly archivo: NombreArchivo;
  readonly causa: CausaError;
  constructor(archivo: NombreArchivo, causa: CausaError, detalle: string) {
    super(`No se pudo cargar ${archivo}.json (${causa}): ${detalle}`);
    this.name = "ErrorDeDatos";
    this.archivo = archivo;
    this.causa = causa;
  }
}

export function urlDe(nombre: NombreArchivo): string {
  return `${import.meta.env.BASE_URL}data/${nombre}.json?v=${__DATA_VERSION__}`;
}

// Se cachea la PROMESA, no el resultado: N componentes que piden el mismo archivo a la
// vez comparten una sola descarga. Una promesa fallida sale de la caché para poder reintentar.
const cache = new Map<NombreArchivo, Promise<unknown>>();

export function cargar<N extends NombreArchivo>(nombre: N): Promise<Datos<N>> {
  const enCurso = cache.get(nombre);
  if (enCurso) return enCurso as Promise<Datos<N>>;
  const promesa = descargar(nombre);
  cache.set(nombre, promesa);
  promesa.catch(() => {
    if (cache.get(nombre) === promesa) cache.delete(nombre);
  });
  return promesa;
}

async function descargar<N extends NombreArchivo>(nombre: N): Promise<Datos<N>> {
  let respuesta: Response;
  try {
    respuesta = await fetch(urlDe(nombre));
  } catch (e) {
    throw new ErrorDeDatos(nombre, "red", e instanceof Error ? e.message : String(e));
  }
  if (!respuesta.ok) throw new ErrorDeDatos(nombre, "http", `HTTP ${respuesta.status}`);
  let json: unknown;
  try {
    json = await respuesta.json();
  } catch (e) {
    throw new ErrorDeDatos(nombre, "json", e instanceof Error ? e.message : String(e));
  }
  const esLista = Array.isArray(json);
  const esObjeto = typeof json === "object" && json !== null && !esLista;
  if (ES_LISTA[nombre] ? !esLista : !esObjeto) {
    throw new ErrorDeDatos(nombre, "esquema", `se esperaba ${ES_LISTA[nombre] ? "una lista" : "un objeto"}`);
  }
  return json as Datos<N>;
}

// Solo para tests: deja la caché como al arrancar la app.
export function vaciarCacheDeDatos() {
  cache.clear();
}

// Pósters y fotos: CDN público de TMDB (sin API key).
export type AnchoImagen = 92 | 154 | 342;
export function urlImagen(ruta: string | null | undefined, ancho: AnchoImagen = 154): string | null {
  return ruta ? `https://image.tmdb.org/t/p/w${ancho}${ruta}` : null;
}
