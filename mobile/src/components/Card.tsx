// Layout and buttons shared by the receipt screens (card, photo, manual entry).
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Shell({ children }: { children: React.ReactNode }) {
  return <SafeAreaView className="flex-1 bg-white px-6 pb-4 pt-8 dark:bg-neutral-950">{children}</SafeAreaView>;
}

export function Button({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`mt-3 items-center rounded-xl py-4 ${primary ? "bg-brand active:bg-brand-dark" : "bg-neutral-200 dark:bg-neutral-800"} ${disabled ? "opacity-50" : ""}`}
    >
      <Text className={`text-lg font-semibold ${primary ? "text-white" : "text-black dark:text-white"}`}>{label}</Text>
    </Pressable>
  );
}
