const { test, expect } = require("@playwright/test");
const { loginAsNewUser, uniqueEmail, visibleText } = require("./helpers");

test.describe("registration, login, transactions", () => {
  test("register via UI -> lands on home", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/login");
    await page.getByRole("button", { name: /Нет аккаунта/ }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder(/Пароль/).fill("password123");
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();

    await expect(page).toHaveURL("/");
    // "Главная" label is intentionally icon-only (hidden) on very narrow
    // mobile viewports (see Block 1) — check something visible at every size.
    await expect(page.getByText("React-Money")).toBeVisible();
  });

  test("add transaction -> appears in the list", async ({ page }) => {
    await loginAsNewUser(page);

    await page.goto("/transactions");
    await page.getByRole("button", { name: "Добавить запись" }).click();

    const description = `E2E тестовая операция ${Date.now()}`;
    await page.locator("#description").fill(description);
    await page.locator("#summ").fill("321");
    await page.getByRole("button", { name: "Сохранить" }).click();

    await expect(visibleText(page, description)).toBeVisible();
  });

  test("edit a transaction", async ({ page }) => {
    await loginAsNewUser(page);

    await page.goto("/transactions");
    await page.getByRole("button", { name: "Добавить запись" }).click();
    const original = `E2E to-edit ${Date.now()}`;
    await page.locator("#description").fill(original);
    await page.locator("#summ").fill("100");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(visibleText(page, original)).toBeVisible();

    // Открываем меню строки/карточки с этим описанием и жмём "Изменить"
    await visibleText(page, original)
      .locator("xpath=ancestor::tr | ancestor::div[contains(@class,'TransactionCard')]")
      .first()
      .locator("img")
      .first()
      .click();
    await page.getByText("Изменить").click();

    const updated = `E2E edited ${Date.now()}`;
    await page.locator("#description").fill(updated);
    await page.getByRole("button", { name: "Обновить" }).click();

    await expect(visibleText(page, updated)).toBeVisible();
  });

  test("delete a transaction", async ({ page }) => {
    await loginAsNewUser(page);

    await page.goto("/transactions");
    await page.getByRole("button", { name: "Добавить запись" }).click();
    const description = `E2E to-delete ${Date.now()}`;
    await page.locator("#description").fill(description);
    await page.locator("#summ").fill("50");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(visibleText(page, description)).toBeVisible();

    await visibleText(page, description)
      .locator("xpath=ancestor::tr | ancestor::div[contains(@class,'TransactionCard')]")
      .first()
      .locator("img")
      .first()
      .click();
    await page.getByText("Удалить", { exact: true }).click();

    await expect(page.getByText(description)).toHaveCount(0);
  });
});
