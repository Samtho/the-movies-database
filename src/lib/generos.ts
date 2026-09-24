// Géneros de TMDB: color de cada uno (galaxia, filtros) y nombre en español.
export const GENERO_COLOR: Readonly<Record<string, string>> = {
  Drama: "#e0563f", Comedy: "#f0b429", Action: "#4f8df0", Thriller: "#9d6bde",
  Horror: "#7c2d3e", Romance: "#e77fb3", Adventure: "#58c99a", Crime: "#c98f12",
  "Science Fiction": "#39c2d7", Fantasy: "#7fd0ff", Animation: "#ffd166", Family: "#a3d977",
  Documentary: "#8a9693", Mystery: "#6d7fd0", War: "#8f7a5a", History: "#b6a06e",
  Music: "#e5a4cb", Western: "#c97b4a", "TV Movie": "#777777", Foreign: "#777777", Otro: "#666666",
};
export const COLOR_GENERO_DESCONOCIDO = "#666666";

const GENERO_ES: Readonly<Record<string, string>> = {
  Drama: "Drama", Comedy: "Comedia", Action: "Acción", Thriller: "Thriller", Horror: "Terror",
  Romance: "Romance", Adventure: "Aventura", Crime: "Crimen", "Science Fiction": "Ciencia ficción",
  Fantasy: "Fantasía", Animation: "Animación", Family: "Familiar", Documentary: "Documental",
  Mystery: "Misterio", War: "Bélico", History: "Histórico", Music: "Musical", Western: "Western",
  "TV Movie": "Película de TV", Foreign: "Extranjera", Otro: "Otro",
};

// Nombre en español; un género desconocido se muestra tal cual.
export const generoEs = (g: string): string => GENERO_ES[g] ?? g;

export const colorGenero = (g: string): string => GENERO_COLOR[g] ?? COLOR_GENERO_DESCONOCIDO;

// Géneros que tiene sentido ofrecer como filtro en la galaxia (los "cajón de sastre" no).
export const GENEROS_FILTRABLES: readonly string[] = Object.keys(GENERO_COLOR)
  .filter((g) => !["Otro", "Foreign", "TV Movie"].includes(g))
  .slice(0, 12);
