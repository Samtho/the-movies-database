// Paleta de la app en TypeScript, para lo que no pinta Tailwind: canvas del grafo,
// deck.gl y ECharts. Debe coincidir con los tokens @theme de src/index.css
// (lo comprueba src/lib/theme.test.ts).
export const COLOR = {
  stage: "#0a0a0d",
  stageSoft: "#141419",
  ivory: "#f2ede1",
  ivoryDim: "#b6b0a2",
  faint: "#6e695e",
  hairline: "#26262e",
  marquee: "#f0b429",
  marqueeDeep: "#c98f12",
  blood: "#e0563f",
  leaf: "#58c99a",
} as const;

// Nombre del token CSS (--color-*) que corresponde a cada clave.
export const TOKEN_CSS: Readonly<Record<keyof typeof COLOR, string>> = {
  stage: "stage",
  stageSoft: "stage-soft",
  ivory: "ivory",
  ivoryDim: "ivory-dim",
  faint: "faint",
  hairline: "hairline",
  marquee: "marquee",
  marqueeDeep: "marquee-deep",
  blood: "blood",
  leaf: "leaf",
};

export type Rgba = [number, number, number, number];

// "#rgb" o "#rrggbb" a [r, g, b, a]. Un color mal formado cae a gris (nunca NaN).
export function hexARgba(hex: string, alfa = 255): Rgba {
  const h = hex.replace("#", "");
  const largo = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(largo)) return [102, 102, 102, alfa];
  return [parseInt(largo.slice(0, 2), 16), parseInt(largo.slice(2, 4), 16), parseInt(largo.slice(4, 6), 16), alfa];
}

// ---------- estilo común de ECharts ----------
export const EJE = {
  axisLabel: { color: COLOR.faint },
  axisLine: { lineStyle: { color: COLOR.hairline } },
  splitLine: { lineStyle: { color: COLOR.hairline } },
} as const;

export const TOOLTIP = {
  backgroundColor: COLOR.stageSoft,
  borderColor: COLOR.hairline,
  textStyle: { color: COLOR.ivory },
} as const;
