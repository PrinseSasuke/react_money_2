const { test, expect } = require("@playwright/test");
const { loginAsNewUser, uniqueEmail, visibleText } = require("./helpers");

// Меню действий строки таблицы (десктоп) или карточки (мобильный список).
async function openRowMenu(page, text) {
  await page
    .getByTestId("transaction-item")
    .filter({ hasText: text })
    .getByRole("button", { name: "Действия с операцией" })
    .click();
}

async function addTransaction(page, description, summ) {
  await page.getByRole("button", { name: "Добавить запись" }).click();
  await page.locator("#description").fill(description);
  await page.locator("#summ").fill(summ);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(visibleText(page, description)).toBeVisible();
}

test.describe("registration, login, transactions", () => {
  test("register via UI -> lands on home", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/login");
    await page.getByRole("button", { name: /Нет аккаунта/ }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder(/Пароль/).fill("password123");
    await page.getByRole("button", { name: "Зарегистрироваться" }).click();

    await expect(page).toHaveURL("/");
    // Бренд виден при любой ширине: в сайдбаре на десктопе, в шапке на мобильном.
    await expect(page.getByText("React-Money")).toBeVisible();
  });

  test("add transaction -> appears in the list", async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/transactions");
    await addTransaction(page, `E2E тестовая операция ${Date.now()}`, "321");
  });

  test("edit a transaction", async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/transactions");
    const original = `E2E to-edit ${Date.now()}`;
    await addTransaction(page, original, "100");

    await openRowMenu(page, original);
    await page.getByRole("menuitem", { name: "Изменить" }).click();

    const updated = `E2E edited ${Date.now()}`;
    await page.locator("#description").fill(updated);
    await page.getByRole("button", { name: "Обновить" }).click();

    await expect(visibleText(page, updated)).toBeVisible();
  });

  test("delete a transaction", async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/transactions");
    const description = `E2E to-delete ${Date.now()}`;
    await addTransaction(page, description, "50");

    await openRowMenu(page, description);
    await page.getByRole("menuitem", { name: "Удалить" }).click();

    await expect(page.getByText(description)).toHaveCount(0);
  });
});
