import Constants from "expo-constants";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { coreFetch } from "@/api/fetcher";
import { getGetReadyQueryOptions } from "@/api/generated/receipts";
import { config } from "@/lib/config";
import { useSession } from "@/lib/session";

export default function Settings() {
  const { user, signOut } = useSession();
  const core = useQuery({ queryKey: ["core-health"], queryFn: () => coreFetch<{ status: string }>("/api/health"), retry: false });
  const receipts = useQuery({ ...getGetReadyQueryOptions(), retry: false });

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white px-6 dark:bg-black">
      <Text className="mt-4 text-3xl font-bold text-black dark:text-white">Настройки</Text>

      <Item label="Вы вошли как" value={user?.email ?? "—"} />
      <Item label="Версия" value={Constants.expoConfig?.version ?? "—"} />

      <Text className="mb-1 mt-8 text-lg font-semibold text-black dark:text-white">Связь с сервисами</Text>
      <Check label="react-money" url={config.coreApiUrl} loading={core.isFetching} ok={core.isSuccess} />
      <Check label="Сервис чеков" url={config.receiptsApiUrl} loading={receipts.isFetching} ok={receipts.isSuccess} />
      <Pressable onPress={() => { core.refetch(); receipts.refetch(); }} className="mt-3 self-start rounded-lg bg-neutral-200 px-4 py-2 dark:bg-neutral-800">
        <Text className="text-base text-black dark:text-white">Проверить ещё раз</Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={signOut} className="mt-10 items-center rounded-xl border border-red-500 py-3">
        <Text className="text-lg font-semibold text-red-600">Выйти</Text>
      </Pressable>
    </SafeAreaView>
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
