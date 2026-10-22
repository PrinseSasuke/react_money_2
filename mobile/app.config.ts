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
    // camera and fingerprint (ТЗ: «Права»); the gallery uses the system photo picker, no storage permission
    permissions: ["android.permission.CAMERA", "android.permission.USE_BIOMETRIC"],
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"],
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
    // the system photo picker. No cameraPermission: false here: the plugin would then strip CAMERA from the whole app
    ["expo-image-picker", { photosPermission: "Фото нужны, чтобы найти QR-код на скриншоте или снимке чека.", microphonePermission: false }],
    ["expo-local-authentication", { faceIDPermission: "Face ID нужен для входа в приложение без пароля." }],
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
