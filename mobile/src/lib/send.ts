// The one way a receipt leaves a screen: into the queue, sending starts, the status screen opens.
// Used by the receipt card, the photo card, manual entry and the scanner's «отправлять сразу».
import { router } from "expo-router";
import type { FnsReceipt } from "@react-money/shared";
import { queue, type Choice } from "@/lib/queue";
import { prefs } from "@/lib/prefs";
import { flushQueue } from "@/lib/sender";
import { authToken } from "@/lib/token";

type Nav = "push" | "replace";

function remember(choice: Choice) {
  // ТЗ: «счёт по умолчанию — последний»
  if (choice.accountId !== undefined && choice.accountId !== prefs.get().accountId) prefs.set({ accountId: choice.accountId });
}

function open(localId: string, nav: Nav, again: boolean) {
  const params = { id: localId, local: "1", ...(again ? { again: "1" } : {}) };
  if (nav === "replace") router.replace({ pathname: "/receipt/[id]", params });
  else router.push({ pathname: "/receipt/[id]", params });
}

export function sendReceipt(r: FnsReceipt, choice: Choice, nav: Nav) {
  const userId = authToken.userId();
  if (!userId) return;
  remember(choice);
  const { item, isNew } = queue.enqueue(userId, r, choice);
  void flushQueue();
  open(item.localId, nav, !isNew);
}

export function sendPhoto(uri: string, mimeType: string, choice: Choice, nav: Nav) {
  const userId = authToken.userId();
  if (!userId) return;
  remember(choice);
  const item = queue.enqueuePhoto(userId, uri, mimeType, choice);
  void flushQueue();
  open(item.localId, nav, false);
}
