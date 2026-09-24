// Ficha de persona: su filmografía en esta base con tu historial encima.
import type { Ficha, Fichas, Vistas } from "./schema";

export type Rol = "dirige" | "actúa";
export type Participacion = { id: number; f: Ficha; rol: Rol };

// Películas en las que aparece `nombre` (dirigiendo o actuando) y su mejor foto.
// Si dirige y actúa en la misma película cuenta una vez, como "dirige".
// Orden: primero las vistas, luego de la más reciente a la más antigua; empate por título.
export function filmografia(nombre: string, fichas: Fichas): { pelis: Participacion[]; foto: string | null } {
  const pelis: Participacion[] = [];
  let foto: string | null = null;
  for (const [id, f] of Object.entries(fichas)) {
    if (f.d === nombre) {
      pelis.push({ id: Number(id), f, rol: "dirige" });
      foto ??= f.dp ?? null;
      continue;
    }
    const i = f.c.indexOf(nombre);
    if (i >= 0) {
      pelis.push({ id: Number(id), f, rol: "actúa" });
      foto ??= f.cp?.[i] ?? null;
    }
  }
  pelis.sort((a, b) => b.f.v - a.f.v || b.f.a - a.f.a || a.f.t.localeCompare(b.f.t));
  return { pelis, foto };
}

// Fecha (AAAA-MM-DD) de la última de estas películas que viste; null si ninguna.
export function ultimaVista(pelis: readonly Participacion[], vistas: Vistas): string | null {
  let ultima: string | null = null;
  for (const p of pelis) {
    const d = vistas[String(p.id)]?.d;
    if (d && (ultima == null || d > ultima)) ultima = d;
  }
  return ultima;
}
