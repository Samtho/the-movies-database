// "¿Qué veo esta noche?": candidatas no vistas del modelo de gusto, cruzadas con su ficha.
import type { Candidata, Ficha, Fichas, GrupoPorque } from "./schema";
import { coincide } from "./texto";

export type CandidataConFicha = Candidata & { f: Ficha };
export type PeliculaConFicha = { id: number; f: Ficha };
export type GrupoConFichas = { origen: PeliculaConFicha; n: number; recs: PeliculaConFicha[] };
export type FiltrosNoche = { genero: string | null; decada: number | null; maxMinutos: number };

export const MINUTOS_MIN = 80;
export const MINUTOS_MAX = 240;
export const TOPE_SORPRESA = 400; // la sorpresa sale del top-400, no de cualquier candidata

export const decadaDe = (anio: number) => Math.floor(anio / 10) * 10;

// Las candidatas sin ficha se descartan (no hay qué mostrar), conservando el orden del modelo.
export function unirCandidatas(candidatos: readonly Candidata[], fichas: Fichas): CandidataConFicha[] {
  const salida: CandidataConFicha[] = [];
  for (const c of candidatos) {
    const f = fichas[String(c.id)];
    if (f) salida.push({ ...c, f });
  }
  return salida;
}

// Una película sin duración conocida (null o 0) no se descarta por el filtro de minutos.
// Con el tope al máximo, el filtro de minutos no descarta nada.
export function filtrarCandidatas(lista: readonly CandidataConFicha[], { genero, decada, maxMinutos }: FiltrosNoche): CandidataConFicha[] {
  return lista.filter((c) =>
    (!genero || c.f.g.includes(genero)) &&
    (decada == null || decadaDe(c.f.a) === decada) &&
    (maxMinutos >= MINUTOS_MAX || c.f.rt == null || c.f.rt <= 0 || c.f.rt <= maxMinutos));
}

// Décadas presentes en las candidatas, de la más antigua a la más reciente.
export function decadasDe(lista: readonly CandidataConFicha[]): number[] {
  return [...new Set(lista.map((c) => decadaDe(c.f.a)))].sort((a, b) => a - b);
}

// Los n géneros más frecuentes; empate: orden alfabético (estable entre recargas).
export function generosFrecuentes(lista: readonly CandidataConFicha[], n = 10): string[] {
  const cuenta = new Map<string, number>();
  for (const c of lista) for (const g of c.f.g) cuenta.set(g, (cuenta.get(g) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([g]) => g);
}

// Score en porcentaje para la insignia: truncado y como mucho 99. Al sumar la calidad, el
// score de las primeras se acerca a 1 y redondeado diría "100%", una certeza que no existe.
export const porcentajeScore = (s: number): number => Math.min(99, Math.max(0, Math.floor(s * 100)));

// Una candidata al azar del top; null si no hay ninguna. `azar` inyectable para tests.
export function elegirSorpresa(lista: readonly CandidataConFicha[], azar: () => number = Math.random, tope = TOPE_SORPRESA): number | null {
  const top = lista.slice(0, tope);
  if (top.length === 0) return null;
  const i = Math.min(top.length - 1, Math.floor(azar() * top.length));
  return top[i].id;
}

// Búsqueda por título original o en español (sin tildes ni mayúsculas); primero las más votadas.
export function buscarPeliculas(fichas: Fichas, consulta: string, limite = 6): [number, Ficha][] {
  const res: [number, Ficha][] = [];
  for (const [id, f] of Object.entries(fichas)) if (coincide(consulta, f.t, f.te)) res.push([Number(id), f]);
  return res.sort((a, b) => b[1].nv - a[1].nv).slice(0, limite);
}

// "Porque te gustó X": cada favorita con sus sugerencias, todas con ficha. Una sugerencia
// sin ficha se omite; un grupo sin favorita o sin sugerencias que mostrar, también.
export function unirPorque(grupos: readonly GrupoPorque[], fichas: Fichas): GrupoConFichas[] {
  const salida: GrupoConFichas[] = [];
  for (const g of grupos) {
    const f = fichas[String(g.id)];
    const recs = g.recs.flatMap((id) => {
      const fr = fichas[String(id)];
      return fr ? [{ id, f: fr }] : [];
    });
    if (f && recs.length > 0) salida.push({ origen: { id: g.id, f }, n: g.n, recs });
  }
  return salida;
}
