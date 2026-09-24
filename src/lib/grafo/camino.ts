// Grados de separación: camino más corto entre dos nodos (búsqueda en anchura).

// Devuelve los nodos del camino, de `desde` a `hasta`, o null si no están conectados
// o algún índice no existe. Mismo nodo: [desde]. Determinista: ante empates gana el
// primer vecino en el orden de la lista de adyacencia.
export function caminoMasCorto(ady: readonly number[][], desde: number, hasta: number): number[] | null {
  const n = ady.length;
  if (desde < 0 || hasta < 0 || desde >= n || hasta >= n) return null;
  if (desde === hasta) return [desde];
  const previo = new Int32Array(n).fill(-1);
  const visto = new Uint8Array(n);
  const cola = new Int32Array(n); // cola con puntero: O(1) por extracción (shift() era O(n))
  let cabeza = 0, fin = 0;
  cola[fin++] = desde;
  visto[desde] = 1;
  while (cabeza < fin) {
    const u = cola[cabeza++];
    for (const v of ady[u]) {
      if (visto[v]) continue;
      visto[v] = 1;
      previo[v] = u;
      if (v === hasta) {
        const camino = [hasta];
        for (let c = hasta; c !== desde; c = previo[c]) camino.push(previo[c]);
        return camino.reverse();
      }
      cola[fin++] = v;
    }
  }
  return null;
}

// En un grafo película-persona, cada "grado" es un salto persona-película-persona.
export const gradosDeSeparacion = (camino: readonly number[]): number => Math.floor(camino.length / 2);
