import { expect, test } from "@playwright/test";
import { aislarRed } from "./red";

test("desde 'Esta noche' se abre una ficha y Escape la cierra", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  const primera = page.locator("main button.group").first();
  await expect(primera).toBeVisible({ timeout: 15_000 });
  const titulo = (await primera.locator("div.truncate").first().textContent())?.trim() ?? "";
  await primera.click();
  const dialogo = page.getByRole("dialog", { name: `Ficha de ${titulo}` });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole("heading", { level: 3, name: titulo })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
});

test("Escape cierra solo el modal de arriba: persona y luego ficha", async ({ page }) => {
  await aislarRed(page);
  // abrir Toy Story desde el buscador de 'Esta noche'
  await page.goto("./#noche");
  await page.getByPlaceholder(/busca una película/).fill("toy story");
  await page.getByRole("option").filter({ hasText: /^Toy Story \(1995\)/ }).click();
  const ficha = page.getByRole("dialog", { name: "Ficha de Toy Story" });
  await expect(ficha).toBeVisible();
  await ficha.getByRole("button", { name: /Tom Hanks/ }).click();
  const persona = page.getByRole("dialog", { name: "Tom Hanks" });
  await expect(persona).toBeVisible();
  await expect(persona).toContainText(/Has visto \d+ de sus \d+ películas/);
  await page.keyboard.press("Escape");
  await expect(persona).toBeHidden();
  await expect(ficha).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ficha).toBeHidden();
});

test("la búsqueda ignora tildes: 'amelie' encuentra Amélie", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  await page.getByPlaceholder(/busca una película/).fill("amelie");
  await expect(page.getByRole("option").filter({ hasText: "Amélie" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Ficha de Amélie" })).toBeVisible();
});

test("el grafo calcula los grados de separación entre dos personas", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#grafo");
  await page.getByRole("button", { name: "Grados de separación" }).click();
  await page.getByPlaceholder(/^De…/).fill("Tom Hanks");
  await page.getByRole("option").filter({ hasText: /Tom Hanks.*actor/ }).first().click();
  await page.getByPlaceholder(/^a…/).fill("Tim Allen");
  await page.getByRole("option").filter({ hasText: /Tim Allen.*actor/ }).first().click();
  await expect(page.getByText(/1 grado de separación/)).toBeVisible();
});
