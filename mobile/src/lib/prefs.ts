// Settings kept on the phone (ТЗ, «Настройки»). MMKV: read synchronously, so the scanner knows
// «отправлять сразу» the moment a QR is read.
import { useSyncExternalStore } from "react";
import { createMMKV } from "react-native-mmkv";

export interface Prefs {
  /** account for new receipts; null = react-money's oldest account (what receipts-worker picks) */
  accountId: string | null;
  /** send straight from the scanner, without the receipt card */
  autoSend: boolean;
  vibrate: boolean;
  /** ask for the fingerprint / face when the app opens */
  biometric: boolean;
}

const DEFAULTS: Prefs = { accountId: null, autoSend: false, vibrate: true, biometric: false };

const storage = createMMKV({ id: "prefs" });
let cache: Prefs | null = null;
const listeners = new Set<() => void>();

function read(): Prefs {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(storage.getString("prefs") ?? "{}") as Partial<Prefs>) };
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export const prefs = {
  get: read,
  set(patch: Partial<Prefs>) {
    cache = { ...read(), ...patch };
    storage.set("prefs", JSON.stringify(cache));
    listeners.forEach((l) => l());
  },
};

export function usePrefs(): Prefs {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);
}
