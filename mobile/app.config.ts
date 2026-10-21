// App config. APP_VARIANT picks the build: "development" (dev build that loads JS from the laptop over Wi-Fi)
// or "production". Set by eas.json per build profile.
import type { ConfigContext, ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "Чеки (dev)" : "Чеки react-money",
  slug: "react-money-receipts",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "reactmoney",
  userInterfaceStyle: "automatic",
  android: {
    // a separate id for the dev build, so it can sit next to a production build on one phone
    package: IS_DEV ? "ru.reactmoney.receipts.dev" : "ru.reactmoney.receipts",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // camera only (ТЗ: «Права»); the gallery picker in M3 needs no permission on Android 13+
    permissions: ["android.permission.CAMERA"],
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: IS_DEV ? "ru.reactmoney.receipts.dev" : "ru.reactmoney.receipts",
    infoPlist: {
      NSCameraUsageDescription: "Камера нужна, чтобы считывать QR-код с кассового чека.",
    },
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#208AEF", image: "./assets/images/splash-icon.png", imageWidth: 76 }],
    "expo-secure-store",
    // sends the receipt queue while the app is closed (ТЗ, «Офлайн и синхронизация»)
    "expo-background-task",
    [
      "expo-build-properties",
      {
        // plain HTTP is allowed only in the dev build, which talks to the laptop on the local network;
        // the production build works over HTTPS only (ТЗ: «Безопасность»)
        android: { usesCleartextTraffic: IS_DEV },
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  owner: "sergey_pirkov",
  extra: {
    eas: { projectId: "32b5373d-8968-470d-8a31-3108b1b6d141" },
  },
});
