import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api/fetcher";
import { useSession } from "@/lib/session";

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) return setError("Введите email и пароль");
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Неверный email или пароль"
          : err instanceof ApiError && err.status === 0
            ? "Нет связи с react-money. Телефон и ноутбук в одной сети Wi-Fi?"
            : "Не получилось войти, попробуйте ещё раз",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-black dark:text-white">Чеки</Text>
        <Text className="mb-8 mt-1 text-base text-neutral-500">Вход под учётной записью react-money</Text>

        <TextInput
          className="mb-3 rounded-xl border border-neutral-300 px-4 py-3 text-lg text-black dark:border-neutral-700 dark:text-white"
          placeholder="Email"
          placeholderTextColor="#8a8a8a"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="mb-3 rounded-xl border border-neutral-300 px-4 py-3 text-lg text-black dark:border-neutral-700 dark:text-white"
          placeholder="Пароль"
          placeholderTextColor="#8a8a8a"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />

        {error && <Text className="mb-3 text-base text-red-600">{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={submit}
          className="mt-2 items-center rounded-xl bg-brand py-4 active:bg-brand-dark disabled:opacity-60"
        >
          {busy ? <ActivityIndicator color="white" /> : <Text className="text-lg font-semibold text-white">Войти</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
