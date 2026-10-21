// M0: placeholder of the scanner (VisionCamera comes in M1) + a check that the phone reaches both services.
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { coreFetch } from "@/api/fetcher";
import { getGetReadyQueryOptions } from "@/api/generated/receipts";

export default function Scanner() {
  const core = useQuery({ queryKey: ["core-health"], queryFn: () => coreFetch<{ status: string }>("/api/health") });
  const receipts = useQuery({ ...getGetReadyQueryOptions(), retry: false });

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white px-6 dark:bg-black">
      <Text className="mt-4 text-3xl font-bold text-black dark:text-white">Сканер</Text>
      <View className="mt-6 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 py-24 dark:border-neutral-700">
        <Text className="text-center text-lg text-neutral-500">Камера и считывание QR{"\n"}появятся в этапе M1</Text>
      </View>

      <Text className="mb-2 mt-8 text-lg font-semibold text-black dark:text-white">Связь с сервисами</Text>
      <Check label="react-money (core-api)" loading={core.isPending} ok={core.isSuccess} />
      <Check label="Сервис чеков" loading={receipts.isPending} ok={receipts.isSuccess} />
      <Pressable onPress={() => { core.refetch(); receipts.refetch(); }} className="mt-4 self-start rounded-lg bg-neutral-200 px-4 py-2 dark:bg-neutral-800">
        <Text className="text-base text-black dark:text-white">Проверить ещё раз</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Check({ label, loading, ok }: { label: string; loading: boolean; ok: boolean }) {
  return (
    <View className="flex-row items-center py-1.5">
      {loading ? <ActivityIndicator /> : <Text className="text-lg">{ok ? "✅" : "❌"}</Text>}
      <Text className="ml-3 text-base text-black dark:text-white">{label}</Text>
    </View>
  );
}
