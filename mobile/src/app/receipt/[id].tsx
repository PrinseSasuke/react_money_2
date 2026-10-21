// What happened to a receipt. `local=1` → `id` is the on-phone queue entry: it shows «Ждёт отправки» until
// receipts-api has accepted it, then the server status. The server status is polled every 1.5 s while the
// screen is open until it is final (ТЗ, «Офлайн и синхронизация», п. 5).
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { STATUS_LABEL, errorText, isFinal } from "@react-money/shared";
import { useGetReceipt } from "@/api/generated/receipts";
import { dateTime, money } from "@/lib/format";
import { useQueueItem } from "@/lib/queue";
import { retryNow } from "@/lib/sender";

export default function ReceiptStatus() {
  const { id, local, again } = useLocalSearchParams<{ id: string; local?: string; again?: string }>();
  const item = useQueueItem(local ? id : undefined);
  const serverId = local ? item?.receiptId : id;

  const { data: r, isError } = useGetReceipt(serverId ?? "", {
    query: {
      enabled: !!serverId,
      refetchInterval: (q) => (q.state.data && isFinal(q.state.data.status) ? false : 1500),
    },
  });

  const onPhone = !!item && !item.receiptId;
  let title: string;
  let color = "text-black dark:text-white";
  let busy = false;
  let note: string | null = null;
  if (local && !item) {
    title = "Чек не найден";
  } else if (onPhone && item.status === "failed") {
    title = errorText(item.lastError);
    color = "text-red-600";
  } else if (onPhone) {
    title = STATUS_LABEL.queued;
    busy = item.status === "sending";
    note = item.lastError ? errorText(item.lastError) : "Отправится сам, как только будет связь. Приложение можно закрыть.";
  } else if (!r) {
    title = isError ? "Не получилось узнать статус" : "Отправляем…";
    busy = !isError;
  } else if (r.status === "parsed") {
    title = `Трата ${r.amount === null ? "" : money(r.amount) + " "}добавлена`;
    color = "text-green-600";
  } else if (r.status === "error") {
    title = errorText(r.error?.code);
    color = "text-red-600";
  } else {
    title = STATUS_LABEL[r.status];
    busy = !isFinal(r.status);
  }
  if (r?.status === "duplicate") note = "Повторный чек не создаёт вторую трату.";
  else if (again) note = "Этот чек уже сканировали — вторая трата не появится.";
  const purchasedAt = r?.purchasedAt ?? item?.purchasedAt;

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pb-4 pt-8 dark:bg-neutral-950">
      <View className="flex-1 items-center justify-center">
        {busy && <ActivityIndicator size="large" />}
        <Text className={`mt-4 text-center text-3xl font-bold ${color}`}>{title}</Text>
        {note && <Text className="mt-3 text-center text-base text-neutral-500">{note}</Text>}
        {onPhone && <Text className="mt-6 text-4xl font-bold text-black dark:text-white">{money(item.amount)}</Text>}
        {purchasedAt && <Text className="mt-3 text-base text-neutral-500">Чек от {dateTime(purchasedAt)}</Text>}
        {onPhone && item.status !== "sending" && (
          <Pressable accessibilityRole="button" onPress={() => retryNow(item.localId)} className="mt-6 rounded-lg bg-neutral-200 px-5 py-2 dark:bg-neutral-800">
            <Text className="text-base text-black dark:text-white">Отправить сейчас</Text>
          </Pressable>
        )}
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
