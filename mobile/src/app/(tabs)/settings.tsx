import Constants from "expo-constants";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { config } from "@/lib/config";
import { useSession } from "@/lib/session";

export default function Settings() {
  const { user, signOut } = useSession();
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white px-6 dark:bg-black">
      <Text className="mt-4 text-3xl font-bold text-black dark:text-white">Настройки</Text>

      <Item label="Вы вошли как" value={user?.email ?? "—"} />
      <Item label="react-money" value={config.coreApiUrl} />
      <Item label="Сервис чеков" value={config.receiptsApiUrl} />
      <Item label="Версия" value={Constants.expoConfig?.version ?? "—"} />

      <Pressable accessibilityRole="button" onPress={signOut} className="mt-8 items-center rounded-xl border border-red-500 py-3">
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
