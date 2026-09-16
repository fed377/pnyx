import {
  FamiljenGrotesk_400Regular,
  FamiljenGrotesk_500Medium,
  FamiljenGrotesk_600SemiBold,
  FamiljenGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/familjen-grotesk";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context";
import { AuthGate } from "@/components/AuthGate";
import { SyncBanner } from "@/components/SyncBanner";
import { ToastProvider } from "@/components/Toast";
import { BlurTargetProvider } from "@/state/blurTarget";
import { PushRegistration } from "@/state/usePushRegistration";
import { SessionProvider } from "@/state/session";
import { StoreProvider } from "@/state/store";
import { c } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    FamiljenGrotesk_400Regular,
    FamiljenGrotesk_500Medium,
    FamiljenGrotesk_600SemiBold,
    FamiljenGrotesk_700Bold,
  });

  useEffect(() => {
    // Errored or loaded — either way there's nothing left to wait for, and
    // holding the splash screen on a font error would strand the app there.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    // GestureHandlerRootView has to sit above everything that uses
    // react-native-gesture-handler (the story viewers' swipe-to-close) —
    // without it, GestureDetector throws at runtime instead of just warning.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* initialMetrics skips the measure-before-first-render pass, which is the other
          way this tree can sit on the splash screen. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SessionProvider>
          <StoreProvider>
            <ToastProvider>
              <BlurTargetProvider>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: "slide_from_right",
                    contentStyle: { backgroundColor: c.app },
                  }}
                />
                <SyncBanner />
                <AuthGate />
                <PushRegistration />
              </BlurTargetProvider>
            </ToastProvider>
          </StoreProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
