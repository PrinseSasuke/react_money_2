const { PermanentError, TemporaryError } = require("./errors");

// Parser interface: parse(receipt) → { amount, purchasedAt, fiscalKey }.
// StubParser reads the FNS QR string itself, without any external call. Real parsing (FNS, a third-party
// service or OCR) will be another implementation of the same interface (ТЗ, section 10, question 7).
class StubParser {
  // delayMs and failRate drive experiments: an artificially slow or flaky parser
  constructor({ delayMs = 0, failRate = 0, random = Math.random } = {}) {
    this.delayMs = delayMs;
    this.failRate = failRate;
    this.random = random;
  }

  async parse(receipt) {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.failRate > 0 && this.random() < this.failRate) {
      throw new TemporaryError("parser_unavailable", "stub parser: simulated temporary failure");
    }
    if (!receipt.qr_raw) {
      throw new PermanentError("ocr_not_implemented", "photos without a QR string are not parsed yet");
    }
    return parseQr(receipt.qr_raw);
  }
}

// t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1
function parseQr(raw) {
  const p = new URLSearchParams(raw);
  const t = p.get("t") || "";
  const m = t.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
  const amount = Number(p.get("s"));
  const [fn, i, fp] = [p.get("fn"), p.get("i"), p.get("fp")];
  if (!m || !Number.isFinite(amount) || amount <= 0 || !fn || !i || !fp) {
    throw new PermanentError("invalid_qr", "the QR string cannot be parsed");
  }
  // time on a Russian receipt is local; Moscow time is assumed until real parsing knows the region
  const purchasedAt = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || "00"}+03:00`);
  if (Number.isNaN(purchasedAt.getTime())) throw new PermanentError("invalid_qr", "the QR date is not a valid date");
  return { amount: Math.round(amount * 100) / 100, purchasedAt, fiscalKey: `${fn}:${i}:${fp}` };
}

function createParser(config) {
  if (config.parser === "stub") return new StubParser({ delayMs: config.parserDelayMs, failRate: config.parserFailRate });
  throw new Error(`unknown PARSER "${config.parser}"`);
}

module.exports = { StubParser, parseQr, createParser };
