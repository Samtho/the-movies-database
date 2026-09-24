import { expect, test } from "@playwright/test";
import { aislarRed, vigilarErrores } from "./red";

// Caracterización: cada vista carga con su título y sin errores.
const VISTAS = [
  { hash: "", titulo: /El cine de/ },
  { hash: "#vida", titulo: /Wrapped/ },
  { hash: "#galaxia", titulo: /películas,/ },
  { hash: "#grafo", titulo: /conectado/ },
  { hash: "#noche", titulo: /candidatas/ },
  { hash: "#formula", titulo: /Nueve modelos/ },
  { hash: "#industria", titulo: /Un siglo de cine/ },
];

for (const v of VISTAS) {
  test(`la vista ${v.hash || "#inicio"} carga sin errores`, async ({ page }) => {
    await aislarRed(page);
    const errores = vigilarErrores(page);
    await page.goto(`./${v.hash}`);
    const titulo = page.getByRole("heading", { name: v.titulo });
    await expect(titulo).toBeVisible({ timeout: 15_000 });
    // visible de verdad: la animación de entrada termina con opacidad 1
    await expect(titulo).toHaveCSS("opacity", "1");
    await page.waitForLoadState("networkidle");
    expect(errores).toEqual([]);
  });
}

test("la portada muestra los contadores del historial", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./");
  await expect(page.getByText("películas vistas")).toBeVisible();
  await expect(page.getByText("horas de cine")).toBeVisible();
});
