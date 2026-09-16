const { app, request, registerUserWithAccount } = require("../helpers");

describe("transactions CRUD", () => {
  it("creates a transaction and lists it back", async () => {
    const { token, accountId } = await registerUserWithAccount();

    const createRes = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", source: "Тест", summ: 100, account_id: accountId });

    expect(createRes.status).toBe(201);
    expect(createRes.body.summ).toBe(100);

    const listRes = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);
  });

  it("requires account_id", async () => {
    const { token } = await registerUserWithAccount();

    const res = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", summ: 100 });

    expect(res.status).toBe(400);
  });

  it("rejects an account_id that isn't the user's own", async () => {
    const { token } = await registerUserWithAccount();
    const other = await registerUserWithAccount();

    const res = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", summ: 100, account_id: other.accountId });

    expect(res.status).toBe(400);
  });

  it("updates a transaction it owns", async () => {
    const { token, accountId } = await registerUserWithAccount();
    const created = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", summ: 100, account_id: accountId });

    const res = await request(app)
      .put(`/api/transactions/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ summ: 250 });

    expect(res.status).toBe(200);
    expect(res.body.summ).toBe(250);
  });

  it("deletes a transaction it owns", async () => {
    const { token, accountId } = await registerUserWithAccount();
    const created = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "Расход", summ: 100, account_id: accountId });

    const res = await request(app)
      .delete(`/api/transactions/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    const listRes = await request(app)
      .get("/api/transactions")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body).toHaveLength(0);
  });

  describe("ownership isolation", () => {
    it("can't read another user's transaction", async () => {
      const owner = await registerUserWithAccount();
      const stranger = await registerUserWithAccount();

      const created = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ type: "Расход", summ: 100, account_id: owner.accountId });

      const res = await request(app)
        .get(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${stranger.token}`);

      expect(res.status).toBe(404);
    });

    it("can't update another user's transaction", async () => {
      const owner = await registerUserWithAccount();
      const stranger = await registerUserWithAccount();

      const created = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ type: "Расход", summ: 100, account_id: owner.accountId });

      const res = await request(app)
        .put(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${stranger.token}`)
        .send({ summ: 999 });

      expect(res.status).toBe(404);
    });

    it("can't delete another user's transaction", async () => {
      const owner = await registerUserWithAccount();
      const stranger = await registerUserWithAccount();

      const created = await request(app)
        .post("/api/transactions")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ type: "Расход", summ: 100, account_id: owner.accountId });

      const res = await request(app)
        .delete(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${stranger.token}`);

      expect(res.status).toBe(404);

      const listRes = await request(app)
        .get("/api/transactions")
        .set("Authorization", `Bearer ${owner.token}`);
      expect(listRes.body).toHaveLength(1);
    });
  });
});
