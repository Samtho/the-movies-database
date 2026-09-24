// Presupuesto de rendimiento: falla si el JavaScript que la portada descarga antes de
// ser usable supera el límite (comprimido con gzip, como lo sirve GitHub Pages).
// Uso: node scripts/presupuesto.mjs  (después de npm run build)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const LIMITE_KB = 150;
const DIST = join(import.meta.dirname, "../dist");

const html = readFileSync(join(DIST, "index.html"), "utf8");
// JS inicial: el módulo de entrada y los que el HTML precarga
const rutas = [...html.matchAll(/<(?:script[^>]+src|link[^>]+rel="modulepreload"[^>]+href)="\.\/([^"]+\.js)"/g)].map((m) => m[1]);
if (rutas.length === 0) {
  console.error("presupuesto: no encontré el JS de entrada en dist/index.html");
  process.exit(1);
}
let total = 0;
for (const ruta of new Set(rutas)) {
  const kb = gzipSync(readFileSync(join(DIST, ruta))).length / 1024;
  total += kb;
  console.log(`  ${ruta.padEnd(40)} ${kb.toFixed(1)} KB gzip`);
}
console.log(`JS inicial: ${total.toFixed(1)} KB gzip (límite ${LIMITE_KB} KB)`);
if (total > LIMITE_KB) {
  console.error(`presupuesto superado en ${(total - LIMITE_KB).toFixed(1)} KB`);
  process.exit(1);
}
