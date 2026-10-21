// Expo's Metro config already handles the pnpm workspace (packages/shared); NativeWind adds Tailwind.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: "./src/global.css" });
