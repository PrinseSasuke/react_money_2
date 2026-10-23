// What receipts-api returns, checked at runtime: a phone build lives for weeks, the server may change
// meanwhile, and a malformed answer must surface as a clear error, not as a crash on a screen.
import { z } from "zod";

export const RECEIPT_STATUSES = ["accepted", "processing", "parsed", "duplicate", "error"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const receiptSchema = z.object({
  id: z.string(),
  status: z.enum(RECEIPT_STATUSES),
  source: z.enum(["qr", "photo"]),
  accountId: z.string().nullable(),
  category: z.string().nullish(),
  amount: z.number().nullable(),
  purchasedAt: z.string().nullable(),
  transactionId: z.string().nullable(),
  error: z.object({ code: z.string(), message: z.string().nullable() }).nullable(),
  attempts: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const acceptedSchema = z.object({ id: z.string(), status: z.literal("accepted") });

export const receiptListSchema = z.object({
  items: z.array(receiptSchema),
  limit: z.number(),
  offset: z.number(),
});

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), id: z.string().optional() }),
});

/** A receipt that will not change any more: stop polling its status. */
export const isFinal = (status: ReceiptStatus) => status === "parsed" || status === "duplicate" || status === "error";
