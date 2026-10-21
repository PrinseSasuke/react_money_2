const jwt = require("jsonwebtoken");
const pino = require("pino");
const request = require("supertest");
const { createApp } = require("../src/app");
const { createMetrics } = require("../src/metrics");

const SECRET = "test-secret";
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const QR = "t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1";
const PNG = Buffer.from("89504e470d0a1a0a", "hex");

const token = (userId = USER) => `Bearer ${jwt.sign({ userId }, SECRET, { expiresIn: "1h" })}`;

// In-memory stand-ins for Postgres, S3 and NATS; `fail` switches a dependency off.
function fakes() {
  const rows = new Map();
  const fail = { db: false, storage: false, queue: false };
  const down = (name) => { if (fail[name]) throw new Error(`${name} is down`); };
  const db = {
    rows,
    ping: async () => down("db"),
    insertReceipt: async (r) => {
      down("db");
      rows.set(r.id, { id: r.id, user_id: r.userId, account_id: r.accountId, category: r.category || null, source: r.source, qr_raw: r.qrRaw,
        image_key: r.imageKey, status: r.status, error_code: r.errorCode || null, error_message: r.errorMessage || null,
        amount: null, purchased_at: null, transaction_id: null, attempts: 0, created_at: new Date(), updated_at: new Date() });
    },
    markError: async (id, code, message) => Object.assign(rows.get(id), { status: "error", error_code: code, error_message: message }),
    getReceipt: async (id, userId) => { down("db"); const r = rows.get(id); return r && r.user_id === userId ? r : null; },
    listReceipts: async (userId) => { down("db"); return [...rows.values()].filter((r) => r.user_id === userId); },
  };
  const storage = { objects: new Map(), ping: async () => down("storage"), put: async (k, b) => { down("storage"); storage.objects.set(k, b); } };
  const queue = { tasks: [], ping: async () => down("queue"), publish: async (t) => { down("queue"); queue.tasks.push(t); } };
  return { db, storage, queue, fail };
}

function build() {
  const f = fakes();
  const app = createApp({ ...f, metrics: createMetrics(), logger: pino({ level: "silent" }), jwtSecret: SECRET, maxUploadMb: 1 });
  return { app, ...f };
}

describe("POST /api/receipts", () => {
  test("QR → 202, row accepted, task queued", async () => {
    const { app, db, queue } = build();
    const res = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("accepted");
    expect(db.rows.get(res.body.id)).toMatchObject({ status: "accepted", source: "qr", qr_raw: QR, user_id: USER });
    expect(queue.tasks).toEqual([expect.objectContaining({ receiptId: res.body.id, userId: USER, source: "qr" })]);
  });

  test("photo → 202, file stored under {userId}/{receiptId}.png", async () => {
    const { app, db, storage } = build();
    const res = await request(app).post("/api/receipts").set("Authorization", token())
      .attach("image", PNG, { filename: "r.png", contentType: "image/png" });
    expect(res.status).toBe(202);
    const key = `${USER}/${res.body.id}.png`;
    expect(storage.objects.has(key)).toBe(true);
    expect(db.rows.get(res.body.id)).toMatchObject({ source: "photo", image_key: key });
  });

  test("accountId is kept", async () => {
    const { app, db } = build();
    const accountId = "33333333-3333-4333-8333-333333333333";
    const res = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR, accountId });
    expect(db.rows.get(res.body.id).account_id).toBe(accountId);
  });

  test("category is kept and returned", async () => {
    const { app, db } = build();
    const res = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR, category: "Супермаркеты" });
    expect(db.rows.get(res.body.id).category).toBe("Супермаркеты");
    const got = await request(app).get(`/api/receipts/${res.body.id}`).set("Authorization", token());
    expect(got.body.category).toBe("Супермаркеты");
  });

  test("too long category → 400", async () => {
    const { app } = build();
    const res = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR, category: "x".repeat(65) });
    expect(res.status).toBe(400);
  });

  test.each([
    ["no token", (r) => r.send({ qr: QR }), 401],
    ["bad token", (r) => r.set("Authorization", "Bearer nope").send({ qr: QR }), 401],
    ["neither photo nor QR", (r) => r.set("Authorization", token()).send({}), 400],
    ["invalid QR", (r) => r.set("Authorization", token()).send({ qr: "s=1" }), 400],
    ["bad accountId", (r) => r.set("Authorization", token()).send({ qr: QR, accountId: "x" }), 400],
    ["unsupported format", (r) => r.set("Authorization", token()).attach("image", Buffer.from("GIF89a"), { filename: "r.gif", contentType: "image/gif" }), 415],
    ["file over the limit", (r) => r.set("Authorization", token()).attach("image", Buffer.alloc(1024 * 1024 + 1), { filename: "r.jpg", contentType: "image/jpeg" }), 413],
  ])("%s → %i", async (_, send, status) => {
    const { app, queue } = build();
    const res = await send(request(app).post("/api/receipts"));
    expect(res.status).toBe(status);
    expect(res.body.error).toHaveProperty("code");
    expect(queue.tasks).toHaveLength(0);
  });

  test("storage down: photo → 503 storage_unavailable, QR still accepted", async () => {
    const { app, db, fail } = build();
    fail.storage = true;
    const photo = await request(app).post("/api/receipts").set("Authorization", token())
      .attach("image", PNG, { filename: "r.png", contentType: "image/png" });
    expect(photo.status).toBe(503);
    expect(photo.body.error.code).toBe("storage_unavailable");
    expect(db.rows.get(photo.body.error.id)).toMatchObject({ status: "error", error_code: "storage_unavailable" });

    const qr = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR });
    expect(qr.status).toBe(202);
  });

  test("queue down → 503 queue_unavailable, receipt marked error", async () => {
    const { app, db, fail } = build();
    fail.queue = true;
    const res = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("queue_unavailable");
    expect(db.rows.get(res.body.error.id)).toMatchObject({ status: "error", error_code: "queue_unavailable" });
  });

  test("database down → 503 database_unavailable", async () => {
    const { app, fail, queue } = build();
    fail.db = true;
    const res = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("database_unavailable");
    expect(queue.tasks).toHaveLength(0);
  });
});

describe("GET /api/receipts", () => {
  test("own receipt → 200, someone else's or unknown → 404", async () => {
    const { app } = build();
    const created = await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR });
    const own = await request(app).get(`/api/receipts/${created.body.id}`).set("Authorization", token());
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ id: created.body.id, status: "accepted", source: "qr" });
    expect((await request(app).get(`/api/receipts/${created.body.id}`).set("Authorization", token(OTHER))).status).toBe(404);
    expect((await request(app).get("/api/receipts/not-a-uuid").set("Authorization", token())).status).toBe(404);
  });

  test("list shows only the user's receipts", async () => {
    const { app } = build();
    await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR });
    await request(app).post("/api/receipts").set("Authorization", token(OTHER)).send({ qr: QR });
    const res = await request(app).get("/api/receipts?limit=10").set("Authorization", token());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});

describe("health, readiness, metrics", () => {
  test("/healthz is always ok", async () => {
    expect((await request(build().app).get("/healthz")).status).toBe(200);
  });

  test("/readyz lists what is down", async () => {
    const { app, fail } = build();
    expect((await request(app).get("/readyz")).status).toBe(200);
    fail.queue = true;
    fail.storage = true;
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.body.down).toEqual(["nats", "s3"]);
  });

  test("/metrics counts accepted receipts", async () => {
    const { app } = build();
    await request(app).post("/api/receipts").set("Authorization", token()).send({ qr: QR });
    const res = await request(app).get("/metrics");
    expect(res.text).toMatch(/receipts_received_total\{source="qr"\} 1/);
    expect(res.text).toMatch(/receipts_http_request_duration_seconds_count\{route="\/api\/receipts\/",code="202"\} 1/);
  });
});
