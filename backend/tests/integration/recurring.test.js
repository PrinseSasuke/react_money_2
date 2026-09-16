const { app, request, registerUserWithAccount } = require("../helpers");
const { runDueRecurring } = require("../../src/services/recurringRunner");

describe("recurring transactions", () => {
  it("creates a recurring template", async () => {
    const { token, accountId } = await registerUserWithAccount();

    const res = await request(app)
      .post("/api/recurring")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Расход",
        source: "Подписка",
        summ: 500,
        frequency: "monthly",
        next_run_date: "2020-01-01",
        account_id: accountId,
      });

    expect(res.status).toBe(201);
    expect(res.body.active).toBe(true);
  });

  it("rejects an invalid frequency", async () => {
    const { token } = await registerUserWithAccount();

    const res = await request(app)
      .post("/api/recurring")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", summ: 500, frequency: "hourly", next_run_date: "2020-01-01" });

    expect(res.status).toBe(400);
  });

  it("toggles active via PUT", async () => {
    const { token, accountId } = await registerUserWithAccount();
    const created = await request(app)
      .post("/api/recurring")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Расход",
        summ: 500,
        frequency: "monthly",
        next_run_date: "2020-01-01",
        account_id: accountId,
      });

    const res = await request(app)
      .put(`/api/recurring/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it("runDueRecurring() generates a transaction for a due template and advances next_run_date", async () => {
    const { token, accountId, user } = await registerUserWithAccount();

    const created = await request(app)
      .post("/api/recurring")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Расход",
        source: "Подписка",
        summ: 799,
        frequency: "monthly",
        next_run_date: "2020-01-01", // давно просрочено -> точно попадёт в выборку
        account_id: accountId,
      });

    const createdCount = await runDueRecurring();
    expect(createdCount).toBeGreaterThanOrEqual(1);

    const txRes = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${token}`);
    const generated = txRes.body.find((t) => t.is_auto_generated && t.summ === 799);
    expect(generated).toBeTruthy();

    const recurringRes = await request(app)
      .get("/api/recurring")
      .set("Authorization", `Bearer ${token}`);
    const updated = recurringRes.body.find((r) => r.id === created.body.id);
    expect(updated.next_run_date).not.toBe("2020-01-01");
  });

  it("deletes a recurring template", async () => {
    const { token, accountId } = await registerUserWithAccount();
    const created = await request(app)
      .post("/api/recurring")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Расход",
        summ: 500,
        frequency: "weekly",
        next_run_date: "2030-01-01",
        account_id: accountId,
      });

    const res = await request(app)
      .delete(`/api/recurring/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const listRes = await request(app)
      .get("/api/recurring")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body.find((r) => r.id === created.body.id)).toBeUndefined();
  });
});
