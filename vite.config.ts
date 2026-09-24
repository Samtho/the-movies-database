import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Versión de los datos: hash del contenido de public/data/*.json en el momento del build.
// La app la añade a cada petición (?v=...), así cada versión del JS pide su propio
// juego de datos y un refresco nunca mezcla archivos viejos y nuevos en la caché.
function versionDeDatos(): Plugin {
  return {
    name: "version-de-datos",
    config() {
      const dir = join(import.meta.dirname, "public/data");
      const hash = createHash("sha256");
      for (const archivo of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
        hash.update(archivo).update(readFileSync(join(dir, archivo)));
      }
      return { define: { __DATA_VERSION__: JSON.stringify(hash.digest("hex").slice(0, 12)) } };
    },
  };
}

// base relativa: la app se sirve bajo /the-movies-database/ en GitHub Pages
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), versionDeDatos()],
});
