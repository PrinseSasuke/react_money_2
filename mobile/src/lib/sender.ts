// Sends queued receipts to receipts-api. Safe to call as often as wanted: one run at a time, and a call that
// arrives during a run makes it go round once more. Used by the foreground triggers and the background task.
import { RETRYABLE } from "@react-money/shared";
import { ApiError, receiptsFetch } from "@/api/fetcher";
import { createReceipt, getCreateReceiptUrl } from "@/api/generated/receipts";
import type { Accepted } from "@/api/generated/model";
import { queue, type QueuedReceipt } from "@/lib/queue";
import { authToken } from "@/lib/token";

// ТЗ: «повтор … с паузами 5 с → 30 с → 2 мин → 10 мин»
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000];

let running = false;
let again = false;

export type FlushResult = "done" | "busy" | "signed-out" | "unauthorized";

export async function flushQueue(): Promise<FlushResult> {
  if (running) {
    again = true;
    return "busy";
  }
  running = true;
  try {
    do {
      again = false;
      const userId = authToken.userId();
      if (!userId) return "signed-out";
      const due = queue
        .all()
        .filter((i) => i.userId === userId && i.status === "queued" && i.nextAttemptAt <= Date.now())
        .reverse(); // oldest first
      for (const item of due) {
        if ((await sendOne(item)) === "unauthorized") return "unauthorized";
      }
    } while (again);
    return "done";
  } finally {
    running = false;
  }
}

async function sendOne(item: QueuedReceipt): Promise<"ok" | "retry" | "failed" | "unauthorized"> {
  queue.update(item.localId, { status: "sending" });
  try {
    const accepted = item.kind === "photo" ? await sendPhoto(item) : await createReceipt({ qr: item.qr!, ...choiceOf(item) });
    queue.update(item.localId, { status: "sent", receiptId: accepted.id, lastError: undefined });
    return "ok";
  } catch (err) {
    const e = err instanceof ApiError ? err : new ApiError(0, "network", String(err));
    if (e.status === 401) {
      // the session signs out; the receipt waits in the queue and goes after the next sign-in (ТЗ, п. 7)
      queue.update(item.localId, { status: "queued", nextAttemptAt: 0, lastError: "unauthorized" });
      return "unauthorized";
    }
    if (e.status === 0 || e.status >= 500 || RETRYABLE.has(e.code)) {
      const attempts = item.attempts + 1;
      const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
      queue.update(item.localId, { status: "queued", attempts, nextAttemptAt: Date.now() + delay, lastError: e.code });
      return "retry";
    }
    // 400 invalid_qr and the like: sending again cannot help
    queue.update(item.localId, { status: "failed", attempts: item.attempts + 1, lastError: e.code });
    return "failed";
  }
}

function choiceOf(item: QueuedReceipt) {
  return { ...(item.accountId ? { accountId: item.accountId } : {}), ...(item.category ? { category: item.category } : {}) };
}

// multipart/form-data: React Native's FormData takes a file as { uri, name, type }
function sendPhoto(item: QueuedReceipt): Promise<Accepted> {
  const form = new FormData();
  const ext = item.mimeType === "image/png" ? "png" : item.mimeType === "image/webp" ? "webp" : "jpg";
  form.append("image", { uri: item.imageUri!, name: `receipt.${ext}`, type: item.mimeType ?? "image/jpeg" } as unknown as Blob);
  for (const [k, v] of Object.entries(choiceOf(item))) form.append(k, v);
  return receiptsFetch<Accepted>(getCreateReceiptUrl(), { method: "POST", body: form });
}

/** «Повторить» for a failed or waiting receipt: try right now. */
export function retryNow(localId: string) {
  queue.update(localId, { status: "queued", nextAttemptAt: 0 });
  void flushQueue();
}
