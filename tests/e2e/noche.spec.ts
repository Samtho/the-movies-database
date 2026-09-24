import { expect, test } from "@playwright/test";
import { aislarRed } from "./red";

test("mover el filtro de minutos tras 'Sorpréndeme' no deja la lista vacía", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  const tarjetas = page.locator("main button.group");
  await expect(tarjetas.first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Sorpréndeme/ }).click();
  await expect(tarjetas).toHaveCount(1);
  await page.getByRole("slider").fill("120");
  await expect(tarjetas).toHaveCount(30);
});

test("filtros sin resultados muestran un aviso y se pueden quitar", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  await expect(page.locator("main button.group").first()).toBeVisible({ timeout: 15_000 });
  const decadas = await page.getByRole("combobox", { name: "Década de estreno" }).locator("option").allTextContents();
  expect(decadas).toContain("1950s"); // antes solo se ofrecían 1960s a 2010s
  // en los 1890s solo hay un documental y una comedia: ningún drama
  await page.getByRole("combobox", { name: "Década de estreno" }).selectOption("1890");
  await page.getByRole("button", { name: "Drama", exact: true }).click();
  await expect(page.getByText("No hay candidatas con estos filtros.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page.locator("main button.group")).toHaveCount(30);
});
