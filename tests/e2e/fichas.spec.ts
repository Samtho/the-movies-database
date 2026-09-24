import { expect, test } from "@playwright/test";
import { aislarRed } from "./red";

test("desde 'Esta noche' se abre una ficha y Escape la cierra", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  const primera = page.locator("main button.group").first();
  await expect(primera).toBeVisible({ timeout: 15_000 });
  const titulo = (await primera.locator("div.truncate").first().textContent())?.trim() ?? "";
  await primera.click();
  await expect(page.getByRole("heading", { level: 3, name: titulo })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { level: 3, name: titulo })).toBeHidden();
});

test("el grafo calcula los grados de separación entre dos personas", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#grafo");
  await page.getByRole("button", { name: "Grados de separación" }).click();
  await page.getByPlaceholder(/^De…/).fill("Tom Hanks");
  await page.getByRole("button", { name: /Tom Hanks.*actor/ }).first().click();
  await page.getByPlaceholder(/^a…/).fill("Tim Allen");
  await page.getByRole("button", { name: /Tim Allen.*actor/ }).first().click();
  await expect(page.getByText(/grados? de separación/).last()).toBeVisible();
});
