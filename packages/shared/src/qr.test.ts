import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFnsQr, buildFnsQr } from "./qr.ts";

const QR = "t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1";

test("a valid FNS string: amount, Moscow time, fiscal key, operation", () => {
  const r = parseFnsQr(QR);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.receipt.amount, 1234.5);
  assert.equal(r.receipt.purchasedAt, "2026-10-12T12:30:00.000Z");
  assert.equal(r.receipt.fiscalKey, "7380440700000000:12345:1234567890");
  assert.equal(r.receipt.operation, 1);
});

test("seconds in the time and a missing n (defaults to purchase)", () => {
  const r = parseFnsQr("t=20261012T153045&s=10&fn=7380440700000000&i=1&fp=2");
  assert.ok(r.ok && r.receipt.purchasedAt === "2026-10-12T12:30:45.000Z" && r.receipt.operation === 1);
});

test("spaces around the code are ignored", () => {
  assert.ok(parseFnsQr(`  ${QR}\n`).ok);
});

for (const [name, raw] of [
  ["a URL from some other QR", "https://example.com/?s=10"],
  ["no fiscal sign", QR.replace("&fp=1234567890", "")],
  ["short fn", QR.replace("fn=7380440700000000", "fn=738044")],
  ["month 13", QR.replace("20261012", "20261312")],
  ["zero sum", QR.replace("s=1234.50", "s=0")],
  ["operation 9", QR.replace("n=1", "n=9")],
  ["empty", ""],
] as const) {
  test(`rejects ${name}`, () => {
    const r = parseFnsQr(raw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "QR не похож на чек");
  });
}

test("manual entry builds a string that parses back to the same receipt", () => {
  const raw = buildFnsQr({ fn: "7380440700000000", i: "12345", fp: "1234567890", amount: 1234.5, localDateTime: "2026-10-12T15:30", operation: 1 });
  assert.equal(raw, QR);
  const r = parseFnsQr(raw);
  assert.ok(r.ok && r.receipt.fiscalKey === "7380440700000000:12345:1234567890");
});
