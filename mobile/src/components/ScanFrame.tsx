// The dimmed overlay with a clear square in the middle: where to put the QR code.
import { Text, View } from "react-native";

export const FRAME = 260;

export function ScanFrame({ hint }: { hint: string }) {
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <View className="flex-1 bg-black/55" />
      <View className="flex-row" style={{ height: FRAME }}>
        <View className="flex-1 bg-black/55" />
        <View style={{ width: FRAME, height: FRAME }} className="rounded-3xl border-4 border-white/90" />
        <View className="flex-1 bg-black/55" />
      </View>
      <View className="flex-1 items-center bg-black/55 pt-6">
        <Text className="px-8 text-center text-base text-white">{hint}</Text>
      </View>
    </View>
  );
}
