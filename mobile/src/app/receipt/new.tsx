// Receipt card (ТЗ, «Карточка чека»): amount, date and type straight from the QR, then «Отправить».
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { OPERATION_LABEL, errorText, parseFnsQr } from "@react-money/shared";
import { ApiError } from "@/api/fetcher";
import { getListReceiptsQueryKey, useCreateReceipt } from "@/api/generated/receipts";
import { dateTime, money } from "@/lib/format";

export default function NewReceipt() {
  const { qr } = useLocalSearchParams<{ qr: string }>();
  const parsed = parseFnsQr(qr ?? "");
  const queryClient = useQueryClient();
  const send = useCreateReceipt({
    mutation: {
      onSuccess: (accepted) => {
        queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
        router.replace({ pathname: "/receipt/[id]", params: { id: accepted.id } });
      },
    },
  });

  if (!parsed.ok) {
    return (
      <Shell>
        <Text className="text-2xl font-bold text-black dark:text-white">{parsed.reason}</Text>
        <Button label="Сканировать ещё" onPress={() => router.back()} />
      </Shell>
    );
  }
  const r = parsed.receipt;
  const error = send.error instanceof ApiError ? errorText(send.error.code) : send.error ? errorText(null) : null;

  return (
    <Shell>
      <Text className="text-base text-neutral-500">{OPERATION_LABEL[r.operation]}</Text>
      <Text className="mt-1 text-5xl font-bold text-black dark:text-white">{money(r.amount)}</Text>
      <Text className="mt-2 text-lg text-neutral-600 dark:text-neutral-300">{dateTime(r.purchasedAt)}</Text>
      <Text className="mt-6 text-sm text-neutral-500">ФН {r.fn} · ФД {r.i} · ФП {r.fp}</Text>
      {r.operation !== 1 && (
        <Text className="mt-4 text-base text-amber-600">Это не обычная покупка — трата всё равно запишется как расход.</Text>
      )}

      {error && <Text className="mt-6 text-base text-red-600">{error}</Text>}

      <View className="mt-auto">
        <Button
          primary
          label={send.isError ? "Отправить ещё раз" : "Отправить"}
          busy={send.isPending}
          onPress={() => send.mutate({ data: { qr: r.raw } })}
        />
        <Button label="Отмена" onPress={() => router.back()} />
      </View>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <SafeAreaView className="flex-1 bg-white px-6 pb-4 pt-8 dark:bg-neutral-950">{children}</SafeAreaView>;
}

function Button({ label, onPress, primary, busy }: { label: string; onPress: () => void; primary?: boolean; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      className={`mt-3 items-center rounded-xl py-4 ${primary ? "bg-brand active:bg-brand-dark" : "bg-neutral-200 dark:bg-neutral-800"}`}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={`text-lg font-semibold ${primary ? "text-white" : "text-black dark:text-white"}`}>{label}</Text>
      )}
    </Pressable>
  );
}
