// ТЗ, «Настройки»: счёт по умолчанию, автоотправка, вибрация, вход по отпечатку, выход, версия.
import Constants from "expo-constants";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { coreFetch } from "@/api/fetcher";
import { getGetReadyQueryOptions } from "@/api/generated/receipts";
import { useAccounts } from "@/lib/accounts";
import { biometricAvailable, confirmBiometric } from "@/lib/biometric";
import { config } from "@/lib/config";
import { prefs, usePrefs } from "@/lib/prefs";
import { useQueue } from "@/lib/queue";
import { flushQueue } from "@/lib/sender";
import { useSession } from "@/lib/session";
import { authToken } from "@/lib/token";

export default function Settings() {
  const { user, signOut } = useSession();
  const p = usePrefs();
  const accounts = useAccounts();
  const core = useQuery({ queryKey: ["core-health"], queryFn: () => coreFetch<{ status: string }>("/api/health"), retry: false });
  const receipts = useQuery({ ...getGetReadyQueryOptions(), retry: false });
  const userId = authToken.userId();
  const waiting = useQueue().filter((i) => i.userId === userId && i.status !== "sent" && i.status !== "failed").length;

  const toggleBiometric = async (on: boolean) => {
    if (!on) return prefs.set({ biometric: false });
    if (!(await biometricAvailable())) {
      Alert.alert("Отпечаток не настроен", "Добавьте отпечаток или распознавание лица в настройках телефона.");
      return;
    }
    if (await confirmBiometric("Включить вход по отпечатку")) prefs.set({ biometric: true });
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerClassName="px-6 pb-10">
        <Text className="mt-4 text-3xl font-bold text-black dark:text-white">Настройки</Text>

        <Item label="Вы вошли как" value={user?.email ?? "—"} />
        <Item label="Ждут отправки на телефоне" value={String(waiting)} />
        {waiting > 0 && (
          <Pressable onPress={() => void flushQueue()} className="mt-2 self-start rounded-lg bg-neutral-200 px-4 py-2 dark:bg-neutral-800">
            <Text className="text-base text-black dark:text-white">Отправить сейчас</Text>
          </Pressable>
        )}

        <Section title="Счёт по умолчанию" />
        <Text className="mb-1 text-sm text-neutral-500">Меняется сам, когда выбираете счёт на карточке чека.</Text>
        {accounts.isPending ? (
          <ActivityIndicator className="self-start" />
        ) : accounts.isError ? (
          <Text className="text-base text-neutral-500">Нет связи с react-money</Text>
        ) : (
          [{ id: null, name: "Самый первый счёт" }, ...accounts.data].map((a) => (
            <Pressable
              key={a.id ?? "default"}
              accessibilityRole="radio"
              accessibilityState={{ checked: p.accountId === a.id }}
              onPress={() => prefs.set({ accountId: a.id })}
              className="flex-row items-center py-2.5"
            >
              <View className={`h-5 w-5 rounded-full border-2 ${p.accountId === a.id ? "border-brand bg-brand" : "border-neutral-400"}`} />
              <Text className="ml-3 text-base text-black dark:text-white">{a.name}</Text>
            </Pressable>
          ))
        )}

        <Section title="Сканер" />
        <Toggle label="Отправлять сразу, без карточки" value={p.autoSend} onChange={(v) => prefs.set({ autoSend: v })} />
        <Toggle label="Вибрация при скане" value={p.vibrate} onChange={(v) => prefs.set({ vibrate: v })} />

        <Section title="Вход" />
        <Toggle label="Вход по отпечатку" value={p.biometric} onChange={(v) => void toggleBiometric(v)} />

        <Section title="Связь с сервисами" />
        <Check label="react-money" url={config.coreApiUrl} loading={core.isFetching} ok={core.isSuccess} />
        <Check label="Сервис чеков" url={config.receiptsApiUrl} loading={receipts.isFetching} ok={receipts.isSuccess} />
        <Pressable onPress={() => { core.refetch(); receipts.refetch(); }} className="mt-3 self-start rounded-lg bg-neutral-200 px-4 py-2 dark:bg-neutral-800">
          <Text className="text-base text-black dark:text-white">Проверить ещё раз</Text>
        </Pressable>

        <Item label="Версия" value={Constants.expoConfig?.version ?? "—"} />
        <Pressable accessibilityRole="button" onPress={signOut} className="mt-8 items-center rounded-xl border border-red-500 py-3">
          <Text className="text-lg font-semibold text-red-600">Выйти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title }: { title: string }) {
  return <Text className="mb-1 mt-8 text-lg font-semibold text-black dark:text-white">{title}</Text>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="mr-4 flex-1 text-base text-black dark:text-white">{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-5">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Text className="mt-0.5 text-base text-black dark:text-white">{value}</Text>
    </View>
  );
}

function Check({ label, url, loading, ok }: { label: string; url: string; loading: boolean; ok: boolean }) {
  return (
    <View className="flex-row items-center py-1.5">
      {loading ? <ActivityIndicator /> : <Text className="text-lg">{ok ? "✅" : "❌"}</Text>}
      <View className="ml-3">
        <Text className="text-base text-black dark:text-white">{label}</Text>
        <Text className="text-sm text-neutral-500">{url}</Text>
      </View>
    </View>
  );
}
