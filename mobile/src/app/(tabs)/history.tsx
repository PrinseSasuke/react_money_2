// The user's receipts: those still on the phone (queue) on top, then what receipts-api has.
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { STATUS_LABEL, errorText } from "@react-money/shared";
import { useListReceipts } from "@/api/generated/receipts";
import type { Receipt } from "@/api/generated/model";
import { useQueue, type QueuedReceipt } from "@/lib/queue";
import { flushQueue } from "@/lib/sender";
import { authToken } from "@/lib/token";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
const when = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Entry = { kind: "local"; item: QueuedReceipt } | { kind: "server"; receipt: Receipt };

export default function History() {
  const { data, isPending, isError, refetch, isRefetching } = useListReceipts({ limit: 50 });
  const all = useQueue();
  const userId = authToken.userId();
  const onPhone = all.filter((i) => i.userId === userId && !i.receiptId);
  const acceptedCount = all.length - onPhone.length;

  // fresh statuses every time the tab is opened, and whenever a queued receipt has just been accepted
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  useEffect(() => { void refetch(); }, [acceptedCount, refetch]);

  const entries: Entry[] = [
    ...onPhone.map((item) => ({ kind: "local" as const, item })),
    ...(data?.items ?? []).map((receipt) => ({ kind: "server" as const, receipt })),
  ];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-black">
      <Text className="mx-6 mb-2 mt-4 text-3xl font-bold text-black dark:text-white">История</Text>
      <FlatList
        data={entries}
        keyExtractor={(e) => (e.kind === "local" ? `local:${e.item.localId}` : e.receipt.id)}
        renderItem={({ item }) => (item.kind === "local" ? <LocalRow item={item.item} /> : <Row receipt={item.receipt} />)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void flushQueue(); void refetch(); }} />}
        ListEmptyComponent={
          <Text className="mx-6 mt-8 text-base text-neutral-500">
            {isPending ? "Загрузка…" : isError ? "Нет связи с сервисом чеков. Потяните вниз, чтобы обновить." : "Чеков пока нет"}
          </Text>
        }
        ListFooterComponent={
          isError && entries.length > 0 ? (
            <Text className="mx-6 mt-4 text-sm text-neutral-500">Нет связи с сервисом чеков — показаны только чеки на телефоне.</Text>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

function LocalRow({ item }: { item: QueuedReceipt }) {
  const failed = item.status === "failed";
  return (
    <RowShell
      amount={item.amount === undefined ? "Фото чека" : money.format(item.amount)}
      date={item.purchasedAt ?? item.createdAt}
      status={failed ? errorText(item.lastError) : STATUS_LABEL.queued}
      color={failed ? "text-red-600" : "text-amber-600"}
      onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: item.localId, local: "1" } })}
    />
  );
}

function Row({ receipt }: { receipt: Receipt }) {
  return (
    <RowShell
      amount={receipt.amount === null ? "—" : money.format(receipt.amount)}
      date={receipt.purchasedAt ?? receipt.createdAt}
      status={receipt.status === "error" ? errorText(receipt.error?.code) : STATUS_LABEL[receipt.status]}
      color={receipt.status === "parsed" ? "text-green-600" : receipt.status === "error" ? "text-red-600" : "text-neutral-500"}
      onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: receipt.id } })}
    />
  );
}

function RowShell(p: { amount: string; date: string; status: string; color: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={p.onPress} className="mx-6 border-b border-neutral-200 py-3 active:opacity-60 dark:border-neutral-800">
      <View className="flex-row justify-between">
        <Text className="text-lg font-semibold text-black dark:text-white">{p.amount}</Text>
        <Text className="text-base text-neutral-500">{when.format(new Date(p.date))}</Text>
      </View>
      <Text className={`mt-0.5 text-base ${p.color}`}>{p.status}</Text>
    </Pressable>
  );
}
