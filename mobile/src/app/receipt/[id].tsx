// What happened to a sent receipt. While the screen is open the status is polled every 1.5 s
// until it is final (ТЗ, «Офлайн и синхронизация», п. 5).
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { STATUS_LABEL, errorText, isFinal } from "@react-money/shared";
import { useGetReceipt } from "@/api/generated/receipts";
import { dateTime, money } from "@/lib/format";

export default function ReceiptStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: r, isError } = useGetReceipt(id, {
    query: { refetchInterval: (q) => (q.state.data && isFinal(q.state.data.status) ? false : 1500) },
  });

  const final = r ? isFinal(r.status) : false;
  const title = !r
    ? isError ? "Не получилось узнать статус" : "Отправляем…"
    : r.status === "parsed"
      ? `Трата ${r.amount === null ? "" : money(r.amount) + " "}добавлена`
      : r.status === "error"
        ? errorText(r.error?.code)
        : STATUS_LABEL[r.status];
  const color = r?.status === "parsed" ? "text-green-600" : r?.status === "error" ? "text-red-600" : "text-black dark:text-white";

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pb-4 pt-8 dark:bg-neutral-950">
      <View className="flex-1 items-center justify-center">
        {!final && !isError && <ActivityIndicator size="large" />}
        <Text className={`mt-4 text-center text-3xl font-bold ${color}`}>{title}</Text>
        {r?.status === "duplicate" && (
          <Text className="mt-3 text-center text-base text-neutral-500">Повторный чек не создаёт вторую трату.</Text>
        )}
        {r?.purchasedAt && <Text className="mt-3 text-base text-neutral-500">Чек от {dateTime(r.purchasedAt)}</Text>}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.back()} className="items-center rounded-xl bg-brand py-4 active:bg-brand-dark">
        <Text className="text-lg font-semibold text-white">Сканировать ещё</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.navigate("/history")} className="mt-3 items-center rounded-xl bg-neutral-200 py-4 dark:bg-neutral-800">
        <Text className="text-lg font-semibold text-black dark:text-white">История</Text>
      </Pressable>
    </SafeAreaView>
  );
}
