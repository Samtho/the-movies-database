// Búsqueda de texto tolerante: sin distinguir mayúsculas ni tildes ("amelie" encuentra "Amélie").
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export const LARGO_MINIMO_BUSQUEDA = 2;

// true si la consulta (ya normalizada o no) aparece en alguno de los textos.
export function coincide(consulta: string, ...textos: (string | null | undefined)[]): boolean {
  const q = normalizar(consulta);
  if (q.length < LARGO_MINIMO_BUSQUEDA) return false;
  return textos.some((t) => t != null && normalizar(t).includes(q));
}
