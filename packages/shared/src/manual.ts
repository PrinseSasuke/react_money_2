// Manual entry of a receipt whose QR cannot be read (ТЗ: «Ручной ввод»). The form takes what is printed
// on the receipt; the result is the same QR string a scan would give (buildFnsQr).
import { z } from "zod";
import { buildFnsQr, type FnsOperation } from "./qr.ts";

const digits = (max: number, label: string) =>
  z.string().trim().regex(new RegExp(`^\\d{1,${max}}$`), `${label}: только цифры, до ${max}`);

/** "12.10.2026 15:30" → "2026-10-12T15:30", or null when it is not a real date */
export function parseRuDateTime(text: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd) || Number(hh) > 23 || Number(min) > 59) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export const manualReceiptSchema = z.object({
  fn: z.string().trim().regex(/^\d{16}$/, "ФН — 16 цифр"),
  i: digits(10, "ФД"),
  fp: digits(10, "ФП"),
  amount: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s/g, "").replace(",", "."))
    .refine((s) => /^\d+(\.\d{1,2})?$/.test(s) && Number(s) > 0, "Сумма: например 1245,50"),
  dateTime: z.string().refine((s) => parseRuDateTime(s) !== null, "Дата: ДД.ММ.ГГГГ ЧЧ:ММ"),
  operation: z.enum(["1", "2", "3", "4"]),
});

export type ManualReceiptForm = z.input<typeof manualReceiptSchema>;

/** A valid form → the QR string. */
export function manualToQr(form: z.output<typeof manualReceiptSchema>): string {
  return buildFnsQr({
    fn: form.fn,
    i: form.i,
    fp: form.fp,
    amount: Number(form.amount),
    localDateTime: parseRuDateTime(form.dateTime)!,
    operation: Number(form.operation) as FnsOperation,
  });
}
