// The react-money token, readable synchronously by every request. The source of truth is the secure
// storage (Android Keystore / iOS Keychain); this module only mirrors it in memory.
import * as SecureStore from "expo-secure-store";

const KEY = "react-money.token";
let current: string | null = null;
let unauthorizedHandler: () => void = () => {};

export const authToken = {
  get: () => current,

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
