import { expect, test } from "@playwright/test";
import { aislarRed } from "./red";

test("la portada solo descarga stats.json, una vez y con versión", async ({ page }) => {
  await aislarRed(page);
  const pedidos: string[] = [];
  page.on("request", (r) => { const u = r.url(); if (u.includes("/data/")) pedidos.push(u.split("/data/")[1]); });
  await page.goto("./");
  await expect(page.getByText("películas vistas")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(pedidos).toHaveLength(1);
  expect(pedidos[0]).toMatch(/^stats\.json\?v=[0-9a-f]{12}$/);
});

test("si falla la descarga, se ve el error y el reintento recupera la vista", async ({ page }) => {
  await aislarRed(page);
  let fallar = true;
  await page.route(/\/data\/stats\.json/, (r) => (fallar ? r.fulfill({ status: 503, body: "caído" }) : r.continue()));
  await page.goto("./#vida");
  await expect(page.getByRole("alert")).toContainText("No se pudieron cargar los datos");
  fallar = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: /Wrapped/ })).toBeVisible();
});

test("un JSON corrupto también muestra el error en vez de quedarse cargando", async ({ page }) => {
  await aislarRed(page);
  await page.route(/\/data\/gusto\.json/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{roto" }));
  await page.goto("./#formula");
  await expect(page.getByRole("alert")).toContainText("gusto.json");
});
