// M0: the user's receipts straight from receipts-api (the on-phone queue joins the list in M2).
import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { STATUS_LABEL, errorText } from "@react-money/shared";
import { useListReceipts } from "@/api/generated/receipts";
import type { Receipt } from "@/api/generated/model";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
const when = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function History() {
  const { data, isPending, isError, refetch, isRefetching } = useListReceipts({ limit: 50 });

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-black">
      <Text className="mx-6 mb-2 mt-4 text-3xl font-bold text-black dark:text-white">История</Text>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <Row receipt={item} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        ListEmptyComponent={
          <Text className="mx-6 mt-8 text-base text-neutral-500">
            {isPending ? "Загрузка…" : isError ? "Нет связи с сервисом чеков. Потяните вниз, чтобы обновить." : "Чеков пока нет"}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

function Row({ receipt }: { receipt: Receipt }) {
  const color = receipt.status === "parsed" ? "text-green-600" : receipt.status === "error" ? "text-red-600" : "text-neutral-500";
  return (
    <View className="mx-6 border-b border-neutral-200 py-3 dark:border-neutral-800">
      <View className="flex-row justify-between">
        <Text className="text-lg font-semibold text-black dark:text-white">
          {receipt.amount === null ? "—" : money.format(receipt.amount)}
        </Text>
        <Text className="text-base text-neutral-500">{when.format(new Date(receipt.purchasedAt ?? receipt.createdAt))}</Text>
      </View>
      <Text className={`mt-0.5 text-base ${color}`}>
        {receipt.status === "error" ? errorText(receipt.error?.code) : STATUS_LABEL[receipt.status]}
      </Text>
    </View>
  );
}
