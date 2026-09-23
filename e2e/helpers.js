const { request: pwRequest, expect } = require("@playwright/test");
const { API_URL } = require("./config");

function uniqueEmail(prefix = "e2e") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
}

// Регистрирует пользователя напрямую через API (быстрее, чем через форму —
// UI-регистрация уже отдельно покрыта своим сценарием).
async function registerViaApi(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || "password123";
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API_URL}/auth/register`, {
    data: { email, password },
  });
  const body = await res.json();
  await ctx.dispose();
  return { email, password, token: body.token, user: body.user };
}

// Логинит существующую сессию Playwright, подставляя токен в localStorage
// (быстрее полного прохода через форму логина для тестов, где авторизация —
// не то, что проверяется).
async function loginAsNewUser(page, overrides = {}) {
  const account = await registerViaApi(overrides);
  await page.goto("/login");
  await page.evaluate((token) => localStorage.setItem("token", token), account.token);
  await page.goto("/");
  // Без этой проверки тест после неудачного входа молча продолжился бы
  // на странице логина (так раньше «проходили» a11y-проверки главной).
  await expect(page.getByRole("button", { name: "Меню пользователя" })).toBeVisible();
  return account;
}

// Текст операции может встречаться в DOM больше одного раза (например,
// в списке и в ещё не размонтированном диалоге) — берём видимую копию,
// чтобы не упираться в strict mode Playwright.
function visibleText(page, text, options) {
  return page.getByText(text, options).and(page.locator(":visible"));
}

module.exports = { registerViaApi, loginAsNewUser, uniqueEmail, visibleText };
