const { processTask } = require("../src/processor");
const { StubParser } = require("../src/parser");
const { TemporaryError, PermanentError } = require("../src/errors");
const { createMetrics } = require("../src/metrics");

const QR = "t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1";
const KEY = "7380440700000000:12345:1234567890";
const USER = "11111111-1111-4111-8111-111111111111";

// In-memory receipts schema and core-api
function setup({ receipts = [], coreApi = {} } = {}) {
  const rows = new Map(receipts.map((r) => [r.id, { status: "accepted", attempts: 0, account_id: null, user_id: USER, qr_raw: QR, ...r }]));
  const claims = new Map();
  const db = {
    rows,
    claims,
    getReceipt: async (id) => rows.get(id) || null,
    startProcessing: async (id) => Object.assign(rows.get(id), { status: "processing", attempts: rows.get(id).attempts + 1 }),
    saveParsed: async (id, p) => Object.assign(rows.get(id), { amount: p.amount, fiscal_key: p.fiscalKey }),
    claimFiscalKey: async (userId, key, receiptId) => {
      const k = `${userId}|${key}`;
      if (!claims.has(k)) { claims.set(k, { receipt_id: receiptId, transaction_id: null }); return { ownedByUs: true }; }
      const claim = claims.get(k);
      return { ownedByUs: claim.receipt_id === receiptId, claim };
    },
    finishParsed: async (r, tx) => { Object.assign(rows.get(r.id), { status: "parsed", transaction_id: tx }); claims.get(`${r.user_id}|${r.fiscal_key}`).transaction_id = tx; },
    finishDuplicate: async (id, tx) => Object.assign(rows.get(id), { status: "duplicate", transaction_id: tx }),
    finishError: async (id, code) => Object.assign(rows.get(id), { status: "error", error_code: code }),
    noteRetry: async (id, code) => Object.assign(rows.get(id), { error_code: code }),
  };
  const api = {
    calls: [],
    defaultAccountId: async () => "acc-default",
    createExpense: async (userId, e) => { api.calls.push(e); return `tx-${api.calls.length}`; },
    ...coreApi,
  };
  const deps = { db, parser: new StubParser(), coreApi: api, metrics: createMetrics(), config: { parseTimeoutMs: 1000 } };
  return { db, api, deps };
}
const first = { count: 1, max: 5 };

test("QR → parsed, expense created on the default account with externalId = fiscal key", async () => {
  const { db, api, deps } = setup({ receipts: [{ id: "r1" }] });
  const d = await processTask({ receiptId: "r1" }, first, deps);
  expect(d).toMatchObject({ action: "ack", result: "parsed", transactionId: "tx-1" });
  expect(db.rows.get("r1")).toMatchObject({ status: "parsed", transaction_id: "tx-1", attempts: 1 });
  expect(api.calls[0]).toMatchObject({ accountId: "acc-default", amount: 1234.5, fiscalKey: KEY });
});

test("the account chosen by the user wins over the default", async () => {
  const { api, deps } = setup({ receipts: [{ id: "r1", account_id: "acc-chosen" }] });
  await processTask({ receiptId: "r1" }, first, deps);
  expect(api.calls[0].accountId).toBe("acc-chosen");
});

test("the same QR sent again → duplicate, no second expense", async () => {
  const { db, api, deps } = setup({ receipts: [{ id: "r1" }, { id: "r2" }] });
  await processTask({ receiptId: "r1" }, first, deps);
  const d = await processTask({ receiptId: "r2" }, first, deps);
  expect(d).toMatchObject({ action: "ack", result: "duplicate" });
  expect(db.rows.get("r2")).toMatchObject({ status: "duplicate", transaction_id: "tx-1" });
  expect(api.calls).toHaveLength(1);
});

test("a redelivered message of a finished receipt is only acked", async () => {
  const { api, deps } = setup({ receipts: [{ id: "r1", status: "parsed" }] });
  expect(await processTask({ receiptId: "r1" }, { count: 2, max: 5 }, deps)).toEqual({ action: "ack", result: "redelivered" });
  expect(api.calls).toHaveLength(0);
});

test("crash after claiming the key: the retry of the same receipt still creates the expense", async () => {
  const { db, api, deps } = setup({ receipts: [{ id: "r1" }] });
  db.claims.set(`${USER}|${KEY}`, { receipt_id: "r1", transaction_id: null });
  db.rows.get("r1").status = "processing";
  expect(await processTask({ receiptId: "r1" }, { count: 2, max: 5 }, deps)).toMatchObject({ result: "parsed" });
  expect(api.calls).toHaveLength(1);
});

test("unknown receipt id → ack, nothing done", async () => {
  const { deps } = setup();
  expect(await processTask({ receiptId: "nope" }, first, deps)).toEqual({ action: "ack", result: "missing" });
});

test("photo without QR → error ocr_not_implemented, no retry", async () => {
  const { db, deps } = setup({ receipts: [{ id: "r1", qr_raw: null, source: "photo" }] });
  expect(await processTask({ receiptId: "r1" }, first, deps)).toMatchObject({ action: "ack", result: "error", reason: "ocr_not_implemented" });
  expect(db.rows.get("r1").status).toBe("error");
});

test("core-api rejects (4xx) → error core_api_rejected, no retry", async () => {
  const { db, deps } = setup({
    receipts: [{ id: "r1" }],
    coreApi: { createExpense: async () => { throw new PermanentError("core_api_rejected", "400"); } },
  });
  expect(await processTask({ receiptId: "r1" }, first, deps)).toMatchObject({ action: "ack", result: "error" });
  expect(db.rows.get("r1").error_code).toBe("core_api_rejected");
});

test.each([[1, 1000], [2, 5000], [3, 30000], [4, 120000]])(
  "core-api down, delivery %i → nak with %i ms, receipt stays processing",
  async (count, delayMs) => {
    const { db, deps } = setup({
      receipts: [{ id: "r1" }],
      coreApi: { createExpense: async () => { throw new TemporaryError("core_api_unavailable", "503"); } },
    });
    expect(await processTask({ receiptId: "r1" }, { count, max: 5 }, deps)).toMatchObject({ action: "nak", delayMs, reason: "core_api_unavailable" });
    expect(db.rows.get("r1")).toMatchObject({ status: "processing", error_code: "core_api_unavailable" });
  }
);

test("last delivery still failing → error max_attempts and DLQ", async () => {
  const { db, deps } = setup({
    receipts: [{ id: "r1" }],
    coreApi: { createExpense: async () => { throw new TemporaryError("core_api_unavailable", "503"); } },
  });
  expect(await processTask({ receiptId: "r1" }, { count: 5, max: 5 }, deps)).toMatchObject({ action: "dlq", result: "error", statusWritten: true });
  expect(db.rows.get("r1")).toMatchObject({ status: "error", error_code: "max_attempts" });
});

test("last delivery with the database down → DLQ anyway, flagged as status not written", async () => {
  const { db, deps } = setup({
    receipts: [{ id: "r1" }],
    coreApi: { createExpense: async () => { throw new TemporaryError("core_api_unavailable", "503"); } },
  });
  db.finishError = async () => { throw new Error("database is down"); };
  expect(await processTask({ receiptId: "r1" }, { count: 5, max: 5 }, deps)).toMatchObject({ action: "dlq", statusWritten: false });
});

test("a parser slower than the timeout → temporary parse_timeout", async () => {
  const { deps } = setup({ receipts: [{ id: "r1" }] });
  deps.parser = new StubParser({ delayMs: 200 });
  deps.config.parseTimeoutMs = 50;
  expect(await processTask({ receiptId: "r1" }, first, deps)).toMatchObject({ action: "nak", reason: "parse_timeout" });
});
