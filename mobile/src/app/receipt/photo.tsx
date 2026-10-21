// A picture from the gallery without a readable QR (ТЗ, «Из галереи»): it can still be sent as a photo;
// until OCR exists receipts-api marks it «распознавать текст чека пока не умеем».
import { useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Shell } from "@/components/Card";
import { ChoicePicker, type ChoiceValue } from "@/components/ChoicePicker";
import { prefs } from "@/lib/prefs";
import { sendPhoto } from "@/lib/send";

export default function PhotoReceipt() {
  const { uri, mimeType } = useLocalSearchParams<{ uri: string; mimeType: string }>();
  const [choice, setChoice] = useState<ChoiceValue>({ accountId: prefs.get().accountId, category: null });

  return (
    <Shell>
      <ScrollView className="flex-1" contentContainerClassName="pb-4">
        <Text className="text-2xl font-bold text-black dark:text-white">QR на фото не найден</Text>
        <Text className="mt-2 text-base text-neutral-500">
          Можно ввести данные чека вручную — так трата добавится сразу. Или отправить фото как есть: распознавать текст чека
          сервис пока не умеет, фото сохранится до следующего этапа.
        </Text>
        <Image source={{ uri }} className="mt-4 h-64 w-full rounded-xl bg-neutral-200" resizeMode="contain" />
        <ChoicePicker value={choice} onChange={setChoice} />
      </ScrollView>
      <View>
        <Button primary label="Ввести вручную" onPress={() => router.replace("/receipt/manual")} />
        <Button label="Отправить фото" onPress={() => sendPhoto(uri, mimeType ?? "image/jpeg", choice, "replace")} />
        <Button label="Отмена" onPress={() => router.back()} />
      </View>
    </Shell>
  );
}
