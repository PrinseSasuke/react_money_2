// Receipt card (ТЗ, «Карточка чека»): amount, date and type straight from the QR, account and category, «Отправить».
// «Отправить» only writes the receipt to the on-phone queue and starts sending; the status screen follows it.
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { OPERATION_LABEL, parseFnsQr } from "@react-money/shared";
import { Button, Shell } from "@/components/Card";
import { ChoicePicker, type ChoiceValue } from "@/components/ChoicePicker";
import { dateTime, money } from "@/lib/format";
import { prefs } from "@/lib/prefs";
import { sendReceipt } from "@/lib/send";
import { authToken } from "@/lib/token";

export default function NewReceipt() {
  const { qr } = useLocalSearchParams<{ qr: string }>();
  const parsed = parseFnsQr(qr ?? "");
  const [choice, setChoice] = useState<ChoiceValue>({ accountId: prefs.get().accountId, category: null });

  if (!parsed.ok) {
    return (
      <Shell>
        <Text className="text-2xl font-bold text-black dark:text-white">{parsed.reason}</Text>
        <Button label="Сканировать ещё" onPress={() => router.back()} />
      </Shell>
    );
  }
  const r = parsed.receipt;
  const signedIn = !!authToken.userId();

  return (
    <Shell>
      <ScrollView className="flex-1" contentContainerClassName="pb-4">
        <Text className="text-base text-neutral-500">{OPERATION_LABEL[r.operation]}</Text>
        <Text className="mt-1 text-5xl font-bold text-black dark:text-white">{money(r.amount)}</Text>
        <Text className="mt-2 text-lg text-neutral-600 dark:text-neutral-300">{dateTime(r.purchasedAt)}</Text>
        <Text className="mt-4 text-sm text-neutral-500">ФН {r.fn} · ФД {r.i} · ФП {r.fp}</Text>
        {r.operation !== 1 && (
          <Text className="mt-4 text-base text-amber-600">Это не обычная покупка — трата всё равно запишется как расход.</Text>
        )}
        <ChoicePicker value={choice} onChange={setChoice} />
        {!signedIn && <Text className="mt-6 text-base text-red-600">Нужно войти заново</Text>}
      </ScrollView>

      <View>
        <Button primary label="Отправить" onPress={() => sendReceipt(r, choice, "replace")} />
        <Button label="Отмена" onPress={() => router.back()} />
      </View>
    </Shell>
  );
}
