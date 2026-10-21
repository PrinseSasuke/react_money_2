// QR string of a Russian fiscal receipt (ФНС format), e.g.
//   t=20261012T1530&s=1234.50&fn=7380440700000000&i=12345&fp=1234567890&n=1
// t — date and time (local), s — total, fn — fiscal drive, i — document number (ФД), fp — fiscal sign (ФП),
// n — operation: 1 приход, 2 возврат прихода, 3 расход, 4 возврат расхода.
// The same rules as receipts-api (validation) and receipts-worker (parsing), so the phone rejects a bad
// code before sending it.

export type FnsOperation = 1 | 2 | 3 | 4;

export interface FnsReceipt {
  /** total in roubles, two decimals */
  amount: number;
  /** ISO date-time; the receipt's local time is taken as Moscow time, like the worker does */
  purchasedAt: string;
  fn: string;
  i: string;
  fp: string;
  operation: FnsOperation;
  /** fn:i:fp — the key the server uses to reject duplicates */
  fiscalKey: string;
  /** the string as it should be sent to receipts-api */
  raw: string;
}

export type ParseResult = { ok: true; receipt: FnsReceipt } | { ok: false; reason: string };

const FORMAT: Record<string, RegExp> = {
  t: /^\d{8}T\d{4}(\d{2})?$/,
  s: /^\d+(\.\d{1,2})?$/,
  fn: /^\d{16}$/,
  i: /^\d{1,10}$/,
  fp: /^\d{1,10}$/,
  n: /^[1-4]$/,
};

export function parseFnsQr(text: string): ParseResult {
  const raw = (text ?? "").trim();
  if (!raw || raw.length > 512) return { ok: false, reason: "QR не похож на чек" };
  const p = new URLSearchParams(raw);
  for (const key of ["t", "s", "fn", "i", "fp"]) {
    if (!p.get(key)) return { ok: false, reason: "QR не похож на чек" };
  }
  for (const [key, re] of Object.entries(FORMAT)) {
    const v = p.get(key);
    if (v !== null && !re.test(v)) return { ok: false, reason: "QR не похож на чек" };
  }
  const t = p.get("t")!;
  const iso = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15) || "00"}+03:00`;
  const date = new Date(iso);
  const amount = Math.round(Number(p.get("s")) * 100) / 100;
  if (Number.isNaN(date.getTime()) || iso.slice(5, 7) > "12" || !(amount > 0)) {
    return { ok: false, reason: "QR не похож на чек" };
  }
  const [fn, i, fp] = [p.get("fn")!, p.get("i")!, p.get("fp")!];
  return {
    ok: true,
    receipt: {
      amount,
      purchasedAt: date.toISOString(),
      fn,
      i,
      fp,
      operation: Number(p.get("n") ?? 1) as FnsOperation,
      fiscalKey: `${fn}:${i}:${fp}`,
      raw,
    },
  };
}

export interface ManualReceiptInput {
  fn: string;
  i: string;
  fp: string;
  amount: number;
  /** local date and time of the receipt, as the user reads it: YYYY-MM-DDTHH:MM */
  localDateTime: string;
  operation: FnsOperation;
}

/** Manual entry → the same QR string, so it goes the same way as a scan (ТЗ: «Ручной ввод»). */
export function buildFnsQr(input: ManualReceiptInput): string {
  const t = input.localDateTime.replace(/[-:]/g, "").slice(0, 13); // 2026-10-12T15:30 → 20261012T1530
  const s = input.amount.toFixed(2);
  return `t=${t}&s=${s}&fn=${input.fn}&i=${input.i}&fp=${input.fp}&n=${input.operation}`;
}

export const OPERATION_LABEL: Record<FnsOperation, string> = {
  1: "Покупка",
  2: "Возврат покупки",
  3: "Расход",
  4: "Возврат расхода",
};
