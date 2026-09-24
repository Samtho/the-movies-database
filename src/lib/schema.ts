// Contrato de datos entre el pipeline (Python) y la web.
// Única fuente de verdad de la forma de los 8 JSON de public/data: los tipos de la
// app se infieren de aquí, y tests/data/contrato.test.ts valida los JSON reales en CI.
import { z } from "zod";

const entero = z.number().int();
const rutaImagen = z.string().nullable(); // ruta de TMDB ("/abc.jpg") o null
const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha AAAA-MM-DD");

// ---------- fichas.json: { tmdbId: Ficha } ----------
export const FichaSchema = z.object({
  t: z.string(), // título
  a: entero, // año de estreno
  g: z.array(z.string()), // géneros (inglés, como en TMDB)
  d: z.string().nullable(), // dirección
  dp: rutaImagen.optional(), // foto de quien dirige
  c: z.array(z.string()), // reparto principal
  cp: z.array(rutaImagen).optional(), // fotos del reparto, alineadas con c
  rt: entero.nullable(), // duración en minutos
  va: z.number().nullable(), // nota media
  nv: entero, // número de votos
  p: rutaImagen, // póster
  o: z.string(), // sinopsis
  v: z.union([z.literal(0), z.literal(1)]), // 1 = vista
  reciente: z.literal(1).optional(), // posterior al dataset (traída de la API de TMDB)
  te: z.string().optional(), // título en español, si difiere del original
});
export const FichasSchema = z.record(z.string(), FichaSchema);

// ---------- galaxia.json ----------
export const GalaxiaPuntoSchema = z.object({
  id: entero,
  x: z.number(),
  y: z.number(),
  t: z.string(),
  a: entero,
  g: z.string(), // género principal
  v: z.union([z.literal(0), z.literal(1)]),
  s: z.number(), // nota media (tamaño del punto)
  p: rutaImagen,
});
export const GalaxiaSchema = z.array(GalaxiaPuntoSchema);

// ---------- grafo.json ----------
const NodoBase = { l: z.string(), v: entero, x: z.number(), y: z.number() };
export const NodoPeliculaSchema = z.object({ t: z.literal("m"), id: entero, a: entero, p: rutaImagen, ...NodoBase });
export const NodoPersonaSchema = z.object({ t: z.enum(["d", "a"]), f: rutaImagen.optional(), ...NodoBase });
export const NodoSchema = z.discriminatedUnion("t", [NodoPeliculaSchema, NodoPersonaSchema]);
export const GrafoSchema = z.object({
  nodes: z.array(NodoSchema),
  links: z.array(z.tuple([entero, entero])),
});

// ---------- gusto.json ----------
export const CandidataSchema = z.object({
  id: entero,
  s: z.number().min(0).max(1), // probabilidad según el modelo
  r: z.array(entero), // índices en leyenda: los porqués
});
export const GustoSchema = z.object({
  benchmark: z.record(z.string(), z.object({ auc: z.number(), std: z.number() })),
  auc_cv: z.tuple([z.number(), z.number()]), // AUC media y desviación, validación cruzada 5-fold
  coefs: z.array(z.object({ f: z.string(), w: z.number() })),
  candidatos: z.array(CandidataSchema),
  leyenda: z.array(z.string()),
  backtest: z.object({
    corte: fechaIso,
    n_test: entero,
    n_cand: entero,
    mediana_pct: z.number(),
    top10: z.number(),
    top20: z.number(),
    p100: entero,
    p300: entero,
    p500: entero,
    azar100: z.number(),
    // lo anterior es el resultado conservador (sin votos ni popularidad medidos en 2017);
    // el techo incluye esas variables. La verdad está entre ambos.
    techo: z.object({ mediana_pct: z.number(), top10: z.number(), top20: z.number(), p100: entero }),
    metodo: entero,
  }),
  // notas: las que cuentan para el umbral (películas del dataset); notas_totales: todas las de Trakt
  segunda_etapa: z.object({ activa: z.boolean(), notas: entero, notas_totales: entero, umbral: entero }),
});

// ---------- industria.json ----------
export const IndustriaSchema = z.object({
  serie: z.array(z.object({ y: entero, g: z.string(), n: entero, va: z.number(), rev: entero })),
  // [tmdbId, título, año, presupuesto M$, taquilla M$, nota]
  scatter: z.array(z.tuple([entero, z.string(), entero, z.number(), z.number(), z.number()])),
});

// ---------- similares.json: { tmdbId: [tmdbId, ...] } ----------
export const SimilaresSchema = z.record(z.string(), z.array(entero));

// ---------- vistas.json: { tmdbId: { d: última vez, n: veces } } ----------
export const VistasSchema = z.record(z.string(), z.object({ d: fechaIso, n: entero.min(1) }));

// ---------- stats.json ----------
const Conteo = z.object({ n: z.string(), c: entero });
export const StatsSchema = z.object({
  total_vistas: entero,
  plays: entero,
  minutos: entero,
  match_dataset: entero,
  post2017: entero,
  mensual: z.array(z.tuple([z.string().regex(/^\d{4}-\d{2}$/), entero])),
  semana_hora: z.array(z.array(entero).length(24)).length(7), // lunes..domingo × 0..23 h, hora local
  horas_registradas: entero, // visionados con hora real (el resto se importó solo con fecha)
  decadas: z.array(z.tuple([entero, entero])),
  rewatch: z.array(z.object({ t: z.string(), a: entero.nullable(), n: entero, id: entero.nullable(), p: rutaImagen })),
  top_directores: z.array(Conteo.extend({ p: rutaImagen.optional() })),
  top_actores: z.array(Conteo.extend({ p: rutaImagen.optional() })),
  top_generos: z.array(Conteo),
  ratings: z.array(z.object({ t: z.string(), r: entero.min(1).max(10), id: entero.nullable() })),
  // derivados (pipeline/derivar_front.py)
  muro: z.array(z.object({ id: entero, p: z.string() })),
  resumen: z.object({ universo: entero, auc: z.number(), auc_std: z.number(), modelos: entero }),
});

export const ESQUEMAS = {
  fichas: FichasSchema,
  galaxia: GalaxiaSchema,
  grafo: GrafoSchema,
  gusto: GustoSchema,
  industria: IndustriaSchema,
  similares: SimilaresSchema,
  stats: StatsSchema,
  vistas: VistasSchema,
} as const;

export type NombreArchivo = keyof typeof ESQUEMAS;
export type Datos<N extends NombreArchivo> = z.infer<(typeof ESQUEMAS)[N]>;

export type Ficha = z.infer<typeof FichaSchema>;
export type Fichas = z.infer<typeof FichasSchema>;
export type GalaxiaPunto = z.infer<typeof GalaxiaPuntoSchema>;
export type Nodo = z.infer<typeof NodoSchema>;
export type Grafo = z.infer<typeof GrafoSchema>;
export type Gusto = z.infer<typeof GustoSchema>;
export type Candidata = z.infer<typeof CandidataSchema>;
export type Industria = z.infer<typeof IndustriaSchema>;
export type Vistas = z.infer<typeof VistasSchema>;
export type Stats = z.infer<typeof StatsSchema>;
