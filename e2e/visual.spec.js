const { test, expect } = require("@playwright/test");
const { loginAsNewUser } = require("./helpers");

// Email/имя в шапке у каждого прогона свои (уникальный пользователь) —
// маскируем меню пользователя и приветствие, чтобы скриншоты были стабильны.
const MASKS = (page) => [page.locator(".profile"), page.locator(".greeting")];

// Замораживаем время: от «сегодня» зависят приветствие с датой, календарь
// на главной и дата по умолчанию в диалоге добавления операции.
const FROZEN_NOW = new Date("2026-09-16T09:00:00Z");

async function setTheme(page, theme) {
  const html = page.locator("html");
  const current = await html.getAttribute("data-theme");
  if (current !== theme) {
    await page.getByRole("button", { name: "Переключить тему" }).click();
    await expect(html).toHaveAttribute("data-theme", theme);
  }
}

for (const theme of ["light", "dark"]) {
  test.describe(`visual regression (${theme} theme)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.install({ time: FROZEN_NOW });
    });

    test(`login page — ${theme}`, async ({ page }) => {
      await page.goto("/login");
      await setTheme(page, theme);
      await expect(page).toHaveScreenshot(`login-${theme}.png`);
    });

    test(`dashboard — ${theme}`, async ({ page }) => {
      await loginAsNewUser(page);
      await setTheme(page, theme);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`dashboard-${theme}.png`, { mask: MASKS(page) });
    });

    test(`transactions list (empty state) — ${theme}`, async ({ page }) => {
      await loginAsNewUser(page);
      await setTheme(page, theme);
      await page.goto("/transactions");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`transactions-empty-${theme}.png`, { mask: MASKS(page) });
    });

    test(`add-transaction modal — ${theme}`, async ({ page }) => {
      await loginAsNewUser(page);
      await setTheme(page, theme);
      await page.goto("/transactions");
      await page.getByRole("button", { name: "Добавить запись" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page).toHaveScreenshot(`add-modal-${theme}.png`, { mask: MASKS(page) });
    });
  });
}
