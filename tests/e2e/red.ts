import type { Page } from "@playwright/test";

// PNG transparente de 1x1: sustituye a los pósters de TMDB para que los e2e
// no dependan de la red externa y sean deterministas.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export async function aislarRed(page: Page) {
  await page.route(/image\.tmdb\.org/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
}

// Recoge errores de consola y excepciones no capturadas de la página.
export function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errores.push(`console: ${m.text()}`); });
  return errores;
}
