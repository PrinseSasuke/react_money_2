const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { loginAsNewUser } = require("./helpers");

// Фиксируем текущий уровень доступности: без critical/serious нарушений на
// ключевых страницах. Не гонимся за нулём предупреждений любой строгости —
// см. ТЗ блока 5.5.
async function expectNoSeriousViolations(page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  if (serious.length > 0) {
    console.log(JSON.stringify(serious, null, 2));
  }
  expect(serious).toEqual([]);
}

test("login page has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await expectNoSeriousViolations(page);
});

test("home page has no serious/critical a11y violations", async ({ page }) => {
  await loginAsNewUser(page);
  await page.goto("/");
  await expectNoSeriousViolations(page);
});

test("transactions page has no serious/critical a11y violations", async ({ page }) => {
  await loginAsNewUser(page);
  await page.goto("/transactions");
  await expectNoSeriousViolations(page);
});
