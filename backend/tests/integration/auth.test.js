const { app, request, registerUser, uniqueEmail } = require("../helpers");

describe("POST /api/auth/register", () => {
  it("creates a user and returns a token", async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email.toLowerCase());
  });

  it("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/register").send({ email, password: "password123" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123" });

    expect(res.status).toBe(409);
  });

  it("rejects a short password with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: uniqueEmail(), password: "123" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { email, password } = await registerUser();

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects an incorrect password with 401", async () => {
    const { email } = await registerUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: "password123" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user with a valid token", async () => {
    const { token, email } = await registerUser();

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email.toLowerCase());
  });

  it("rejects a request with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a request with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
