// Where the app finds the services. During development the phone talks to the laptop over Wi-Fi,
// so these are the laptop's LAN address (set in mobile/.env, see .env.example); later — the stand's HTTPS address.
// EXPO_PUBLIC_* values are baked into the JS bundle: never put secrets here.
const required = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`${name} is not set: copy mobile/.env.example to mobile/.env`);
  return value.replace(/\/+$/, "");
};

export const config = {
  coreApiUrl: required("EXPO_PUBLIC_CORE_API_URL", process.env.EXPO_PUBLIC_CORE_API_URL),
  receiptsApiUrl: required("EXPO_PUBLIC_RECEIPTS_API_URL", process.env.EXPO_PUBLIC_RECEIPTS_API_URL),
};
