const request = require("supertest");
const app = require("../src/app");

function uniqueEmail(prefix = "user") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
}

// Регистрирует нового пользователя (каждый вызов — свой уникальный email,
// чтобы тесты не зависели от порядка выполнения и не мешали друг другу на
// общей тестовой БД) и возвращает токен + данные пользователя.
async function registerUser(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || "password123";
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password, displayName: overrides.displayName });
  return { email, password, token: res.body.token, user: res.body.user, response: res };
}

// Регистрирует пользователя и создаёт для него дополнительный счёт (сверх
// дефолтного "Основной"), возвращая id обоих — удобно там, где нужен явный
// account_id для создания транзакций.
async function registerUserWithAccount(overrides = {}) {
  const { token, user } = await registerUser(overrides);
  const accountsRes = await request(app)
    .get("/api/accounts")
    .set("Authorization", `Bearer ${token}`);
  return { token, user, accountId: accountsRes.body[0].id };
}

module.exports = { app, request, registerUser, registerUserWithAccount, uniqueEmail };
