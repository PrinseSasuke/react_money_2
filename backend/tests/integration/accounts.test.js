const { app, request, registerUser, registerUserWithAccount } = require("../helpers");

describe("accounts", () => {
  it("gives a new user a default account on registration", async () => {
    const { token } = await registerUser();

    const res = await request(app).get("/api/accounts").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Основной");
    expect(res.body[0].balance).toBe(0);
  });

  it("creates a second account", async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "USD счёт", type: "card", currency: "USD", initialBalance: 100 });

    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(100);
  });

  it("reflects transactions in the computed balance", async () => {
    const { token, accountId } = await registerUserWithAccount();

    await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Доход", summ: 1000, account_id: accountId });
    await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", summ: 300, account_id: accountId });

    const res = await request(app).get("/api/accounts").set("Authorization", `Bearer ${token}`);
    const account = res.body.find((a) => a.id === accountId);
    expect(account.balance).toBe(700);
  });

  it("blocks deleting the user's last remaining account", async () => {
    const { token, accountId } = await registerUserWithAccount();

    const res = await request(app)
      .delete(`/api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("requires reassignTo when deleting an account with transactions", async () => {
    const { token } = await registerUser();
    const accountsRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${token}`);
    const firstAccount = accountsRes.body[0].id;

    const secondAccountRes = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Second", type: "cash" });
    const secondAccount = secondAccountRes.body.id;

    await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", summ: 50, account_id: secondAccount });

    const deleteRes = await request(app)
      .delete(`/api/accounts/${secondAccount}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(409);

    const reassignRes = await request(app)
      .delete(`/api/accounts/${secondAccount}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reassignTo: firstAccount });
    expect(reassignRes.status).toBe(200);
  });

  it("can't see or delete another user's account", async () => {
    const owner = await registerUserWithAccount();
    const stranger = await registerUserWithAccount();

    const listRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(listRes.body.map((a) => a.id)).not.toContain(owner.accountId);

    const deleteRes = await request(app)
      .delete(`/api/accounts/${owner.accountId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(deleteRes.status).toBe(404);
  });
});
