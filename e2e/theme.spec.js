const { test, expect } = require("@playwright/test");
const { loginAsNewUser } = require("./helpers");

test("theme toggle persists across a reload", async ({ page }) => {
  await loginAsNewUser(page);

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Переключить тему" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");

  // возвращаем светлую тему, чтобы не влиять на другие тесты/скриншоты
  await page.getByRole("button", { name: "Переключить тему" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});
