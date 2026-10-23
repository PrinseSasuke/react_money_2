import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFnsQr } from "./qr.ts";
import { manualReceiptSchema, manualToQr, parseRuDateTime } from "./manual.ts";

const form = { fn: "9960440300000001", i: "12345", fp: "987654321", amount: "1 245,50", dateTime: "12.10.2026 15:30", operation: "1" as const };

test("manual entry gives the same QR string a scan of that receipt would", () => {
  const qr = manualToQr(manualReceiptSchema.parse(form));
  assert.equal(qr, "t=20261012T1530&s=1245.50&fn=9960440300000001&i=12345&fp=987654321&n=1");
  const back = parseFnsQr(qr);
  assert.ok(back.ok);
  assert.equal(back.receipt.fiscalKey, "9960440300000001:12345:987654321");
});

test("manual entry rejects impossible dates and bad fields", () => {
  assert.equal(parseRuDateTime("31.02.2026 10:00"), null);
  assert.equal(parseRuDateTime("12.10.2026 25:00"), null);
  assert.equal(manualReceiptSchema.safeParse({ ...form, fn: "123" }).success, false);
  assert.equal(manualReceiptSchema.safeParse({ ...form, amount: "0" }).success, false);
  assert.equal(manualReceiptSchema.safeParse({ ...form, amount: "12,345" }).success, false);
});
