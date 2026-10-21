// The on-phone receipt queue (ТЗ, «Офлайн и синхронизация»): a receipt is written here first and only then
// sent, so closing the app, losing the network or rebooting the phone never loses it. MMKV keeps it on disk.
import { useSyncExternalStore } from "react";
import { createMMKV } from "react-native-mmkv";
import type { FnsReceipt } from "@react-money/shared";

export type LocalStatus = "queued" | "sending" | "sent" | "failed";

export interface QueuedReceipt {
  localId: string;
  /** owner of the receipt: it is only ever sent with this user's token */
  userId: string;
  qr: string;
  fiscalKey: string;
  amount: number;
  purchasedAt: string;
  createdAt: string;
  status: LocalStatus;
  /** set once receipts-api accepted it (202) */
  receiptId?: string;
  attempts: number;
  /** epoch ms; a queued receipt is not retried before this */
  nextAttemptAt: number;
  lastError?: string;
}

const storage = createMMKV({ id: "receipt-queue" });
const KEY = "items";
const KEEP_SENT_DAYS = 30;

let cache: QueuedReceipt[] | null = null;

function read(): QueuedReceipt[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(storage.getString(KEY) ?? "[]") as QueuedReceipt[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: QueuedReceipt[]) {
  const cutoff = Date.now() - KEEP_SENT_DAYS * 864e5;
  cache = items.filter((i) => i.status !== "sent" || Date.parse(i.createdAt) > cutoff);
  storage.set(KEY, JSON.stringify(cache)); // synchronous: on disk before the next line runs
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const queue = {
  all: read,

  get: (localId: string) => read().find((i) => i.localId === localId),

  /** The same fiscal receipt is queued once per user; scanning it again returns the existing entry. */
  enqueue(userId: string, r: FnsReceipt): { item: QueuedReceipt; isNew: boolean } {
    const existing = read().find((i) => i.userId === userId && i.fiscalKey === r.fiscalKey && i.status !== "failed");
    if (existing) return { item: existing, isNew: false };
    const item: QueuedReceipt = {
      localId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      qr: r.raw,
      fiscalKey: r.fiscalKey,
      amount: r.amount,
      purchasedAt: r.purchasedAt,
      createdAt: new Date().toISOString(),
      status: "queued",
      attempts: 0,
      nextAttemptAt: 0,
    };
    write([item, ...read()]);
    return { item, isNew: true };
  },

  update(localId: string, patch: Partial<QueuedReceipt>) {
    write(read().map((i) => (i.localId === localId ? { ...i, ...patch } : i)));
  },

  /** After a crash mid-send the entry is still "sending": put it back, the server rejects duplicates anyway. */
  recoverInterrupted() {
    if (read().some((i) => i.status === "sending")) {
      write(read().map((i) => (i.status === "sending" ? { ...i, status: "queued" as const, nextAttemptAt: 0 } : i)));
    }
  },
};

export function useQueue(): QueuedReceipt[] {
  return useSyncExternalStore(subscribe, read);
}

export function useQueueItem(localId: string | undefined): QueuedReceipt | undefined {
  const items = useQueue();
  return localId ? items.find((i) => i.localId === localId) : undefined;
}
