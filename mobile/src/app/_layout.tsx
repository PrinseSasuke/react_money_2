import "@/global.css";

import { useEffect } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BiometricGate } from "@/lib/biometric";
import { SessionProvider, useSession } from "@/lib/session";
import { useQueueSync } from "@/lib/sync"; // also defines the background task at module load

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
          <BiometricGate>
            <Routes />
          </BiometricGate>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

// Signed out → only the sign-in screen exists; signed in → only the tabs (Expo Router protected routes).
function Routes() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null; // the splash screen stays up meanwhile

  return (
    <>
      {status === "signedIn" && <QueueSync />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === "signedOut"}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="receipt/new" options={{ presentation: "modal" }} />
          <Stack.Screen name="receipt/photo" options={{ presentation: "modal" }} />
          <Stack.Screen name="receipt/manual" options={{ presentation: "modal" }} />
          <Stack.Screen name="receipt/[id]" options={{ presentation: "modal" }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

// sends the on-phone queue while signed in; after sign-out the receipts wait for the next sign-in
function QueueSync() {
  useQueueSync();
  return null;
}
