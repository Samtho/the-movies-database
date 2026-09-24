import { expect, test } from "@playwright/test";
import { aislarRed } from "./red";

test("el lienzo del grafo es nítido: su resolución sigue la densidad de píxeles", async ({ page, browser }) => {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage();
  await aislarRed(p);
  await p.goto("./#grafo");
  const canvas = p.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const { ancho, css } = await canvas.evaluate((c) => ({ ancho: (c as HTMLCanvasElement).width, css: c.clientWidth }));
  expect(ancho).toBe(css * 2);
  await ctx.close();
  void page;
});

test("en la vista global, la rueda hace zoom sin desplazar la página", async ({ page, isMobile }) => {
  test.skip(isMobile, "la rueda del ratón no aplica en móvil");
  await aislarRed(page);
  await page.goto("./#grafo");
  await page.getByRole("button", { name: "Vista global" }).click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const antes = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);
});

test("clic en un vecino de la rueda viaja a ese nodo", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#grafo");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const titulo = page.locator("main span.font-display.text-2xl");
  const antes = await titulo.textContent();
  const box = (await canvas.boundingBox())!;
  // primer vecino: arriba del centro, a 0,345 del lado menor
  const R = Math.min(box.width, box.height) * 0.345;
  await page.waitForTimeout(500); // fin de la transición de entrada
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 - 8 - R } });
  await expect(titulo).not.toHaveText(antes ?? "");
});
