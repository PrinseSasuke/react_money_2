const { test, expect } = require("@playwright/test");
const { loginAsNewUser } = require("./helpers");

test("setting a low limit and adding an over-limit expense shows a warning", async ({ page }) => {
  await loginAsNewUser(page);

  await page.goto("/limit");
  await page.getByRole("button", { name: "Редактировать лимит" }).click();
  await page.locator('input[type="number"]').fill("100");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Лимит расходов на месяц: 100 ₽")).toBeVisible();

  await page.goto("/transactions");
  await page.getByRole("button", { name: "Добавить запись" }).click();
  await page.locator('input[value="Расход"]').check();
  await page.locator("#summ").fill("500");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await page.goto("/limit");
  await expect(page.getByText("⚠ Лимит расходов превышен!")).toBeVisible();
});
