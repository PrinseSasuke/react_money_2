const { test, expect } = require("@playwright/test");
const { loginAsNewUser } = require("./helpers");

const PAGES = ["/", "/transactions", "/stats", "/accounts", "/recurring", "/limit", "/forecast", "/import"];

for (const path of PAGES) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1); // +1 для окружений с дробным DPR
  });
}
