// Utilidades numéricas seguras. Math.max(...xs) revienta con arrays enormes (límite de
// argumentos del motor: en Safari ronda los 65.000) y da -Infinity con arrays vacíos.

// Máximo de una lista; `vacio` si no hay elementos.
export function maximo(xs: readonly number[], vacio = 0): number {
  let m = Number.NEGATIVE_INFINITY;
  for (const x of xs) if (x > m) m = x;
  return m === Number.NEGATIVE_INFINITY ? vacio : m;
}

export function minimo(xs: readonly number[], vacio = 0): number {
  let m = Number.POSITIVE_INFINITY;
  for (const x of xs) if (x < m) m = x;
  return m === Number.POSITIVE_INFINITY ? vacio : m;
}

// valor / total acotado a [0, 1]; 0 si el total no es positivo (nunca NaN ni Infinity).
export function proporcion(valor: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(valor)) return 0;
  return Math.min(1, Math.max(0, valor / total));
}
