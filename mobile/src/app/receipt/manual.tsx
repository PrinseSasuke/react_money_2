// Manual entry (ТЗ, «Ручной ввод»): ФН, ФД, ФП, sum, date/time and type as printed on the receipt.
// The form builds the same QR string a scan gives, so the receipt goes exactly the same way.
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OPERATION_LABEL, manualReceiptSchema, manualToQr, parseFnsQr, type ManualReceiptForm } from "@react-money/shared";
import { Button, Shell } from "@/components/Card";
import { ChoicePicker, type ChoiceValue } from "@/components/ChoicePicker";
import { prefs } from "@/lib/prefs";
import { sendReceipt } from "@/lib/send";

const pad = (n: number) => String(n).padStart(2, "0");
function nowRu() {
  const d = new Date();
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** digits typed as 12102026153 → "12.10.2026 15:3": the dots, space and colon appear by themselves */
function maskDateTime(text: string) {
  const d = text.replace(/\D/g, "").slice(0, 12);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8), d.slice(8, 10), d.slice(10, 12)];
  let out = parts[0];
  if (d.length > 2) out += "." + parts[1];
  if (d.length > 4) out += "." + parts[2];
  if (d.length > 8) out += " " + parts[3];
  if (d.length > 10) out += ":" + parts[4];
  return out;
}

export default function ManualReceipt() {
  const [choice, setChoice] = useState<ChoiceValue>({ accountId: prefs.get().accountId, category: null });
  const { control, handleSubmit, formState } = useForm<ManualReceiptForm>({
    resolver: zodResolver(manualReceiptSchema),
    defaultValues: { fn: "", i: "", fp: "", amount: "", dateTime: nowRu(), operation: "1" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = parseFnsQr(manualToQr(manualReceiptSchema.parse(values)));
    if (parsed.ok) sendReceipt(parsed.receipt, choice, "replace");
  });

  const field = (name: "fn" | "i" | "fp" | "amount" | "dateTime", label: string, hint: string, opts: { mask?: (s: string) => string; maxLength?: number; decimal?: boolean } = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <View className="mt-4">
          <Text className="text-sm text-neutral-500">{label}</Text>
          <TextInput
            value={f.value}
            onChangeText={(t) => f.onChange(opts.mask ? opts.mask(t) : t)}
            onBlur={f.onBlur}
            placeholder={hint}
            placeholderTextColor="#9ca3af"
            keyboardType={opts.decimal ? "decimal-pad" : "number-pad"}
            maxLength={opts.maxLength}
            className={`mt-1 rounded-xl border px-4 py-3 text-lg text-black dark:text-white ${fieldState.error ? "border-red-500" : "border-neutral-300 dark:border-neutral-700"}`}
          />
          {fieldState.error && <Text className="mt-1 text-sm text-red-600">{fieldState.error.message}</Text>}
        </View>
      )}
    />
  );

  return (
    <Shell>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerClassName="pb-4">
          <Text className="text-2xl font-bold text-black dark:text-white">Ввести чек вручную</Text>
          <Text className="mt-1 text-base text-neutral-500">Эти поля напечатаны внизу чека, рядом с QR-кодом.</Text>

          {field("amount", "Сумма, ₽", "1 245,50", { decimal: true, maxLength: 14 })}
          {field("dateTime", "Дата и время", "ДД.ММ.ГГГГ ЧЧ:ММ", { mask: maskDateTime, maxLength: 16 })}
          {field("fn", "ФН — номер фискального накопителя", "16 цифр", { maxLength: 16 })}
          {field("i", "ФД — номер документа", "до 10 цифр", { maxLength: 10 })}
          {field("fp", "ФП (ФПД) — фискальный признак", "до 10 цифр", { maxLength: 10 })}

          <Text className="mt-4 text-sm text-neutral-500">Тип</Text>
          <Controller
            control={control}
            name="operation"
            render={({ field: f }) => (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {(["1", "2", "3", "4"] as const).map((op) => (
                  <Pressable
                    key={op}
                    accessibilityRole="button"
                    accessibilityState={{ selected: f.value === op }}
                    onPress={() => f.onChange(op)}
                    className={`rounded-full px-4 py-2 ${f.value === op ? "bg-brand" : "bg-neutral-200 dark:bg-neutral-800"}`}
                  >
                    <Text className={`text-base ${f.value === op ? "font-semibold text-white" : "text-black dark:text-white"}`}>
                      {OPERATION_LABEL[Number(op) as 1 | 2 | 3 | 4]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />

          <ChoicePicker value={choice} onChange={setChoice} />
        </ScrollView>

        <View>
          <Button primary label="Отправить" onPress={onSubmit} disabled={formState.isSubmitting} />
          <Button label="Отмена" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </Shell>
  );
}
