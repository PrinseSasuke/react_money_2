// The start screen (ТЗ, «Главный сценарий»): camera at once → point at the QR → vibration → receipt card.
import { useCallback, useRef, useState } from "react";
import { Linking, Pressable, Text, Vibration, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Camera, useCameraPermission } from "react-native-vision-camera";
import { useBarcodeScannerOutput } from "react-native-vision-camera-barcode-scanner";
import { parseFnsQr } from "@react-money/shared";
import { ScanFrame } from "@/components/ScanFrame";
import { pickReceiptImage } from "@/lib/gallery";
import { prefs } from "@/lib/prefs";
import { sendReceipt } from "@/lib/send";

const SAME_CODE_PAUSE_MS = 3000; // ТЗ: «защита от двойного срабатывания на один и тот же QR 3 с»

export default function Scanner() {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [focused, setFocused] = useState(false);
  const [torch, setTorch] = useState(false);
  const [hint, setHint] = useState("Наведите камеру на QR-код чека");
  const last = useRef({ value: "", at: 0 });
  const busy = useRef(false);

  // the camera runs only while this tab is on screen (and stops while the receipt card is open)
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      busy.current = false;
      return () => {
        setFocused(false);
        setTorch(false);
      };
    }, []),
  );

  const onCode = useCallback((raw: string, fromPicture = false) => {
    const now = Date.now();
    if ((busy.current && !fromPicture) || (raw === last.current.value && now - last.current.at < SAME_CODE_PAUSE_MS)) return;
    last.current = { value: raw, at: now };

    const parsed = parseFnsQr(raw);
    if (!parsed.ok) {
      setHint(`${parsed.reason}. Наведите камеру на QR-код кассового чека`);
      return;
    }
    busy.current = true;
    const { vibrate, autoSend, accountId } = prefs.get();
    if (vibrate) Vibration.vibrate(60);
    setHint("Наведите камеру на QR-код чека");
    // ТЗ: «режим „отправлять сразу без карточки“ в настройках»
    if (autoSend) sendReceipt(parsed.receipt, { accountId }, "push");
    else router.push({ pathname: "/receipt/new", params: { qr: parsed.receipt.raw } });
  }, []);

  const fromGallery = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await pickReceiptImage();
      if (res.kind === "qr") onCode(res.qr, true);
      else if (res.kind === "photo") router.push({ pathname: "/receipt/photo", params: { uri: res.uri, mimeType: res.mimeType } });
      else busy.current = false;
    } catch {
      busy.current = false;
      setHint("Не получилось открыть фото, попробуйте другое");
    }
  }, [onCode]);

  const scanner = useBarcodeScannerOutput({
    barcodeFormats: ["qr-code"],
    onBarcodeScanned(barcodes) {
      const raw = barcodes.find((b) => b.rawValue)?.rawValue;
      if (raw) onCode(raw);
    },
    onError() {
      setHint("Камера не смогла прочитать код, попробуйте ещё раз");
    },
  });

  if (!hasPermission) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-8 dark:bg-black">
        <Text className="text-center text-2xl font-bold text-black dark:text-white">Нужен доступ к камере</Text>
        <Text className="mt-3 text-center text-base text-neutral-500">
          Камера нужна только чтобы считывать QR-код с кассового чека. Фото не сохраняются.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
          className="mt-6 rounded-xl bg-brand px-6 py-4"
        >
          <Text className="text-lg font-semibold text-white">{canRequestPermission ? "Разрешить камеру" : "Открыть настройки"}</Text>
        </Pressable>
        {/* the gallery and manual entry work without the camera */}
        <Pressable accessibilityRole="button" onPress={fromGallery} className="mt-8 rounded-xl bg-neutral-200 px-6 py-4 dark:bg-neutral-800">
          <Text className="text-lg font-semibold text-black dark:text-white">Из галереи</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/receipt/manual")} className="mt-3 rounded-xl bg-neutral-200 px-6 py-4 dark:bg-neutral-800">
          <Text className="text-lg font-semibold text-black dark:text-white">Ввести вручную</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Camera
        style={{ flex: 1 }}
        device="back"
        isActive={focused}
        outputs={[scanner]}
        // the torch only while the camera runs: switching it on an inactive camera throws
        torchMode={torch && focused ? "on" : "off"}
        onError={(e) => {
          // a torch or zoom call that lands just as the camera stops: harmless, the next start resets it
          if (!/not active/i.test(e.message)) setHint("Камера не запустилась, попробуйте ещё раз");
        }}
        enableNativeZoomGesture
      />
      <ScanFrame hint={hint} />
      <SafeAreaView edges={["top"]} className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-5">
        <Text className="text-2xl font-bold text-white">Сканер</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? "Выключить фонарик" : "Включить фонарик"}
          onPress={() => setTorch((t) => !t)}
          className={`rounded-full px-4 py-2 ${torch ? "bg-white" : "bg-white/25"}`}
        >
          <Text className={`text-base font-semibold ${torch ? "text-black" : "text-white"}`}>{torch ? "Фонарик вкл" : "Фонарик"}</Text>
        </Pressable>
      </SafeAreaView>
      <SafeAreaView edges={["bottom"]} className="absolute bottom-0 left-0 right-0 flex-row justify-center gap-3 px-5 pb-6">
        <Pressable accessibilityRole="button" onPress={fromGallery} className="rounded-full bg-white/25 px-5 py-3">
          <Text className="text-base font-semibold text-white">Из галереи</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/receipt/manual")} className="rounded-full bg-white/25 px-5 py-3">
          <Text className="text-base font-semibold text-white">Ввести вручную</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
