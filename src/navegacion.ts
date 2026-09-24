// Capítulos de la app. El id es también el hash de la URL (#vida, #galaxia...).
export const CAPS = [
  { id: "inicio", nav: "Inicio" },
  { id: "vida", nav: "Tu vida en cine" },
  { id: "galaxia", nav: "La galaxia" },
  { id: "grafo", nav: "El grafo" },
  { id: "noche", nav: "Esta noche" },
  { id: "formula", nav: "Tu gusto (ML)" },
  { id: "industria", nav: "La industria" },
] as const;

export type CapId = (typeof CAPS)[number]["id"];

// Capítulo a partir del hash de la URL; uno desconocido lleva a la portada.
export function capDesdeHash(hash: string): CapId {
  const h = hash.replace(/^#/, "");
  return CAPS.find((c) => c.id === h)?.id ?? "inicio";
}
