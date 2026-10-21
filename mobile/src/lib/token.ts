// The react-money token, readable synchronously by every request. The source of truth is the secure
// storage (Android Keystore / iOS Keychain); this module only mirrors it in memory.
import * as SecureStore from "expo-secure-store";

const KEY = "react-money.token";
let current: string | null = null;
let unauthorizedHandler: () => void = () => {};

/** userId from the JWT payload — known without network, unlike /api/auth/me */
function userIdOf(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(payload)) as { userId?: string }).userId ?? null;
  } catch {
    return null;
  }
}

export const authToken = {
  get: () => current,
  userId: () => userIdOf(current),

  async load(): Promise<string | null> {
    current = await SecureStore.getItemAsync(KEY);
    return current;
  },

  async save(token: string) {
    await SecureStore.setItemAsync(KEY, token);
    current = token;
  },

  async clear() {
    await SecureStore.deleteItemAsync(KEY);
    current = null;
  },

  /** called by the HTTP layer on 401: the session decides what to do (sign out) */
  onUnauthorized: () => unauthorizedHandler(),
  setUnauthorizedHandler(fn: () => void) {
    unauthorizedHandler = fn;
  },
};
