const { test, expect } = require("@playwright/test");
const { loginAsNewUser } = require("./helpers");

// Профиль (email) в сайдбаре у каждого прогона свой (уникальный юзер) —
// маскируем его, чтобы скриншоты были стабильны между прогонами.
const MASK_PROFILE = (page) => [page.locator(".profile")];

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
    test(`login page — ${theme}`, async ({ page }) => {
      await page.goto("/login");
      if (theme === "dark") {
        await page.getByRole("button", { name: "Переключить тему" }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      }
      await expect(page).toHaveScreenshot(`login-${theme}.png`);
    });

    test(`dashboard — ${theme}`, async ({ page }) => {
      // Замораживаем время, чтобы сетка календаря была одинаковой между прогонами
      await page.clock.install({ time: new Date("2026-09-16T09:00:00Z") });
      await loginAsNewUser(page);
      await setTheme(page, theme);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`dashboard-${theme}.png`, {
        mask: MASK_PROFILE(page),
      });
    });

    test(`transactions list (empty state) — ${theme}`, async ({ page }) => {
      await loginAsNewUser(page);
      await setTheme(page, theme);
      await page.goto("/transactions");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`transactions-empty-${theme}.png`, {
        mask: MASK_PROFILE(page),
      });
    });

    test(`add-transaction modal — ${theme}`, async ({ page }) => {
      await loginAsNewUser(page);
      await setTheme(page, theme);
      await page.goto("/transactions");
      await page.getByRole("button", { name: "Добавить запись" }).click();
      await expect(page.locator(".ReactModal__Content")).toBeVisible();
      await expect(page).toHaveScreenshot(`add-modal-${theme}.png`, {
        mask: MASK_PROFILE(page),
      });
    });
  });
}
