// QR string of a Russian fiscal receipt (ФНС format), e.g.
//   t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1
// t — date and time, s — total, fn — fiscal drive number, i — document number, fp — fiscal sign, n — operation type.
// The API only checks the format; the worker parses it (StubParser).
const REQUIRED = ["t", "s", "fn", "i", "fp"];
const FORMAT = {
  t: /^\d{8}T\d{4}(\d{2})?$/,
  s: /^\d+(\.\d{1,2})?$/,
  fn: /^\d{16}$/,
  i: /^\d{1,10}$/,
  fp: /^\d{1,10}$/,
  n: /^[1-4]$/,
};

function validateQr(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) {
    return { ok: false, message: "строка QR пустая или длиннее 512 символов" };
  }
  const params = new URLSearchParams(raw.trim());
  const missing = REQUIRED.filter((k) => !params.get(k));
  if (missing.length) return { ok: false, message: `в строке QR нет полей: ${missing.join(", ")}` };
  for (const [key, re] of Object.entries(FORMAT)) {
    const v = params.get(key);
    if (v !== null && !re.test(v)) return { ok: false, message: `поле ${key} в строке QR в неверном формате` };
  }
  return { ok: true, value: raw.trim() };
}

module.exports = { validateQr };
