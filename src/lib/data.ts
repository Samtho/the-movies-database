// Carga perezosa de los datos precomputados (pipeline Python) + utilidades.

export type Ficha = {
  t: string; a: number; g: string[]; d: string | null; c: string[];
  dp?: string | null; cp?: (string | null)[];
  rt: number | null; va: number | null; nv: number; p: string | null; o: string; v: number; reciente?: number;
};
export type GalaxiaPunto = { id: number; x: number; y: number; t: string; a: number; g: string; v: number; s: number; p: string | null };
export type GrafoNodo = { t: "m" | "d" | "a"; id?: number; l: string; y?: number; v: number; p?: string | null; x: number; y2?: number } & { x: number; y: number };
export type Stats = {
  total_vistas: number; plays: number; minutos: number; match_dataset: number; post2017: number;
  mensual: [string, number][]; semana_hora: number[][]; decadas: [number, number][];
  rewatch: { t: string; a: number; n: number; id: number | null }[];
  top_directores: { n: string; c: number }[]; top_actores: { n: string; c: number }[];
  top_generos: { n: string; c: number }[]; ratings: { t: string; r: number; id: number | null }[];
};

const cache = new Map<string, unknown>();
export async function carga<T>(nombre: string): Promise<T> {
  if (cache.has(nombre)) return cache.get(nombre) as T;
  const r = await fetch(`${import.meta.env.BASE_URL}data/${nombre}.json`);
  const j = (await r.json()) as T;
  cache.set(nombre, j);
  return j;
}

// Pósters reales servidos por el CDN público de TMDB (sin API key).
export const poster = (p: string | null | undefined, w: 92 | 154 | 342 = 154) =>
  p ? `https://image.tmdb.org/t/p/w${w}${p}` : null;

export const GENERO_COLOR: Record<string, string> = {
  Drama: "#e0563f", Comedy: "#f0b429", Action: "#4f8df0", Thriller: "#9d6bde",
  Horror: "#7c2d3e", Romance: "#e77fb3", Adventure: "#58c99a", Crime: "#c98f12",
  "Science Fiction": "#39c2d7", Fantasy: "#7fd0ff", Animation: "#ffd166", Family: "#a3d977",
  Documentary: "#8a9693", Mystery: "#6d7fd0", War: "#8f7a5a", History: "#b6a06e",
  Music: "#e5a4cb", Western: "#c97b4a", "TV Movie": "#777", Foreign: "#777", Otro: "#666",
};
export const GENERO_ES: Record<string, string> = {
  Drama: "Drama", Comedy: "Comedia", Action: "Acción", Thriller: "Thriller", Horror: "Terror",
  Romance: "Romance", Adventure: "Aventura", Crime: "Crimen", "Science Fiction": "Ciencia ficción",
  Fantasy: "Fantasía", Animation: "Animación", Family: "Familiar", Documentary: "Documental",
  Mystery: "Misterio", War: "Bélico", History: "Histórico", Music: "Musical", Western: "Western",
};
export const gen_es = (g: string) => GENERO_ES[g] ?? g;
