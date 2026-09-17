const { app, request, uniqueEmail } = require("../helpers");
const pool = require("../../src/db");

describe("full user flow: register -> login -> CRUD transaction", () => {
  it("walks the whole path, checking DB state at each step", async () => {
    const email = uniqueEmail("flow");
    const password = "password123";

    // 1. Регистрация
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ email, password });
    expect(registerRes.status).toBe(201);
    const userId = registerRes.body.user.id;

    const userRow = await pool.query("SELECT id, email FROM users WHERE id = $1", [
      userId,
    ]);
    expect(userRow.rows).toHaveLength(1);
    expect(userRow.rows[0].email).toBe(email.toLowerCase());

    // Регистрация должна была создать дефолтный счёт
    const accountRow = await pool.query(
      "SELECT id FROM accounts WHERE user_id = $1",
      [userId]
    );
    expect(accountRow.rows).toHaveLength(1);
    const accountId = accountRow.rows[0].id;

    // 2. Логин (отдельным запросом, не переиспользуя токен регистрации)
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    // 3. Создание транзакции
    const createRes = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Доход", source: "Зарплата", summ: 5000, account_id: accountId });
    expect(createRes.status).toBe(201);
    const transactionId = createRes.body.id;

    const txRowAfterCreate = await pool.query(
      "SELECT summ, type FROM transactions WHERE id = $1",
      [transactionId]
    );
    expect(Number(txRowAfterCreate.rows[0].summ)).toBe(5000);

    // 4. Получение списка
    const listRes = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.map((t) => t.id)).toContain(transactionId);

    // 5. Редактирование
    const updateRes = await request(app)
      .put(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ summ: 5500, description: "Аванс + премия" });
    expect(updateRes.status).toBe(200);

    const txRowAfterUpdate = await pool.query(
      "SELECT summ, description FROM transactions WHERE id = $1",
      [transactionId]
    );
    expect(Number(txRowAfterUpdate.rows[0].summ)).toBe(5500);
    expect(txRowAfterUpdate.rows[0].description).toBe("Аванс + премия");

    // 6. Удаление
    const deleteRes = await request(app)
      .delete(`/api/transactions/${transactionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const txRowAfterDelete = await pool.query(
      "SELECT id FROM transactions WHERE id = $1",
      [transactionId]
    );
    expect(txRowAfterDelete.rows).toHaveLength(0);
  });
});
