import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { AuthGate } from "@/components/AuthGate";
import { SyncBanner } from "@/components/SyncBanner";
import { ToastProvider } from "@/components/Toast";
import { SessionProvider } from "@/state/session";
import { StoreProvider } from "@/state/store";
import { c } from "@/theme/tokens";

export default function RootLayout() {
  return (
    // initialMetrics skips the measure-before-first-render pass, which is the other
    // way this tree can sit on the splash screen.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SessionProvider>
        <StoreProvider>
          <ToastProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: c.app },
            }}
            />
            <SyncBanner />
            <AuthGate />
          </ToastProvider>
        </StoreProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
