const { StubParser, parseQr } = require("../src/parser");

const QR = "t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1";

describe("parseQr", () => {
  test("amount, Moscow time and the fiscal key fn:i:fp", () => {
    const r = parseQr(QR);
    expect(r.amount).toBe(1234.5);
    expect(r.purchasedAt.toISOString()).toBe("2026-10-12T12:30:00.000Z");
    expect(r.fiscalKey).toBe("7380440700000000:12345:1234567890");
  });

  test("seconds in the time", () => {
    expect(parseQr(QR.replace("T1530", "T153045")).purchasedAt.toISOString()).toBe("2026-10-12T12:30:45.000Z");
  });

  test.each([
    ["no date", QR.replace("t=20261012T1530&", "")],
    ["zero sum", QR.replace("s=1234.50", "s=0")],
    ["impossible date", QR.replace("20261012", "20261399")],
  ])("%s → permanent invalid_qr", (_, raw) => {
    expect(() => parseQr(raw)).toThrow(expect.objectContaining({ code: "invalid_qr", temporary: false }));
  });
});

describe("StubParser", () => {
  test("parses a QR receipt", async () => {
    await expect(new StubParser().parse({ qr_raw: QR })).resolves.toMatchObject({ amount: 1234.5 });
  });

  test("a photo without QR → permanent ocr_not_implemented", async () => {
    await expect(new StubParser().parse({ qr_raw: null })).rejects.toMatchObject({ code: "ocr_not_implemented", temporary: false });
  });

  test("PARSER_FAIL_RATE gives temporary failures", async () => {
    const p = new StubParser({ failRate: 0.5, random: () => 0.1 });
    await expect(p.parse({ qr_raw: QR })).rejects.toMatchObject({ code: "parser_unavailable", temporary: true });
  });
});
