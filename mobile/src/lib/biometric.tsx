// «Вход по Face ID / отпечатку после первого раза» (ТЗ, экран «Вход»): the token stays in the secure storage,
// the fingerprint only unlocks the app. Asked on start and after 5 minutes in the background.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { prefs, usePrefs } from "@/lib/prefs";
import { useSession } from "@/lib/session";

const RELOCK_AFTER_MS = 5 * 60_000;

export async function biometricAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function confirmBiometric(reason: string): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: "Отмена" });
  return res.success;
}

export function BiometricGate({ children }: { children: ReactNode }) {
  const { biometric } = usePrefs();
  const { status, signOut } = useSession();
  const [locked, setLocked] = useState(() => prefs.get().biometric);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") hiddenAt.current = Date.now();
      if (s === "active" && hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS && prefs.get().biometric) setLocked(true);
      if (s === "active") hiddenAt.current = null;
    });
    return () => sub.remove();
  }, []);

  const unlock = async () => {
    if (await confirmBiometric("Вход в «Чеки»")) setLocked(false);
  };

  // a password sign-in has just proved who it is: no fingerprint on top of it
  useEffect(() => {
    if (status === "signedOut") setLocked(false);
  }, [status]);

  const show = locked && biometric && status === "signedIn";
  useEffect(() => {
    if (show) void unlock();
  }, [show]);

  // an overlay, not a replacement: the screens underneath keep their state while locked
  return (
    <>
      {children}
      {show && <Lock onUnlock={() => void unlock()} onPassword={() => void signOut()} />}
    </>
  );
}

function Lock({ onUnlock, onPassword }: { onUnlock: () => void; onPassword: () => void }) {
  return (
    <View className="absolute inset-0 items-center justify-center bg-white px-8 dark:bg-black">
      <Text className="text-center text-2xl font-bold text-black dark:text-white">Приложение заблокировано</Text>
      <Pressable accessibilityRole="button" onPress={onUnlock} className="mt-6 rounded-xl bg-brand px-6 py-4">
        <Text className="text-lg font-semibold text-white">Разблокировать</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onPassword} className="mt-4 px-6 py-3">
        <Text className="text-base text-neutral-500">Войти по паролю</Text>
      </Pressable>
    </View>
  );
}
