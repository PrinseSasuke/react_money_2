const { validateQr } = require("../src/qr");

const GOOD = "t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1";

describe("validateQr", () => {
  test("accepts a valid FNS string", () => {
    expect(validateQr(GOOD)).toEqual({ ok: true, value: GOOD });
  });

  test("accepts seconds in the time and a missing n", () => {
    expect(validateQr("t=20261012T153001&s=10&fn=7380440700000000&i=1&fp=2").ok).toBe(true);
  });

  test.each(["t", "s", "fn", "i", "fp"])("rejects a string without %s", (field) => {
    const raw = GOOD.split("&").filter((p) => !p.startsWith(`${field}=`)).join("&");
    const r = validateQr(raw);
    expect(r.ok).toBe(false);
    expect(r.message).toContain(field);
  });

  test.each([
    ["date", GOOD.replace("t=20261012T1530", "t=2026-10-12")],
    ["sum with 3 decimals", GOOD.replace("s=1234.50", "s=1234.505")],
    ["short fn", GOOD.replace("fn=7380440700000000", "fn=738044")],
    ["operation type 9", GOOD.replace("n=1", "n=9")],
  ])("rejects a wrong %s", (_, raw) => {
    expect(validateQr(raw).ok).toBe(false);
  });

  test("rejects empty and non-string input", () => {
    expect(validateQr("").ok).toBe(false);
    expect(validateQr(undefined).ok).toBe(false);
    expect(validateQr("x".repeat(600)).ok).toBe(false);
  });
});
