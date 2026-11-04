import { expect, test } from "@playwright/test";
import { aislarRed } from "./red";

test("mover el filtro de minutos tras 'Sorpréndeme' no deja la lista vacía", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  const tarjetas = page.getByTestId("candidatas").locator("button.group");
  await expect(tarjetas.first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Sorpréndeme/ }).click();
  await expect(tarjetas).toHaveCount(1);
  await page.getByRole("slider").fill("120");
  await expect(tarjetas).toHaveCount(30);
});

test("filtros sin resultados muestran un aviso y se pueden quitar", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  await expect(page.getByTestId("candidatas").locator("button.group").first()).toBeVisible({ timeout: 15_000 });
  const decadas = await page.getByRole("combobox", { name: "Década de estreno" }).locator("option").allTextContents();
  expect(decadas).toContain("1950s"); // antes solo se ofrecían 1960s a 2010s
  // en los 1890s solo hay un documental y una comedia: ningún drama
  await page.getByRole("combobox", { name: "Década de estreno" }).selectOption("1890");
  await page.getByRole("button", { name: "Drama", exact: true }).click();
  await expect(page.getByText("No hay candidatas con estos filtros.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page.getByTestId("candidatas").locator("button.group")).toHaveCount(30);
});

test("'Porque te gustó' cambia de favorita y abre la ficha de una sugerida", async ({ page }) => {
  await aislarRed(page);
  await page.goto("./#noche");
  const sugeridas = page.getByTestId("porque").locator("button.group");
  await expect(sugeridas.first()).toBeVisible({ timeout: 15_000 });
  const chips = page.getByTestId("porque-favoritas").getByRole("button");
  await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
  const segunda = chips.nth(1);
  const nombre = (await segunda.textContent())?.split(" · ")[0].trim() ?? "";
  await segunda.click();
  await expect(segunda).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 2, name: `Porque te gustó ${nombre}` })).toBeVisible();
  const titulo = (await sugeridas.first().locator("div.truncate").first().textContent())?.trim() ?? "";
  await sugeridas.first().click();
  await expect(page.getByRole("dialog", { name: `Ficha de ${titulo}` })).toBeVisible();
});
