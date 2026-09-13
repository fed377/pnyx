import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/state/session";
import { useStore } from "@/state/store";
import { c, s } from "@/theme/tokens";
import { Onboarding } from "./Onboarding";
import { SignIn } from "./SignIn";

/**
 * Sits on top of the navigator rather than replacing it. Gating the tree on an
 * async session read would leave the app stranded on the splash screen, because
 * expo-router only hides it once the navigator mounts.
 */
export function AuthGate() {
  const { ready, session, configured } = useSession();
  const { hydrated, state } = useStore();
  const [skipped, setSkipped] = useState(false);

  // Reading the stored session, or the local store: cover the app so no
  // content — or the onboarding gate below, decided from a stale default — flashes past.
  if (!ready || !hydrated) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        <Text style={styles.wordmark}>PNYX</Text>
      </View>
    );
  }

  const signedInOrExploring = !configured || session !== null || skipped;

  if (!signedInOrExploring) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        <SignIn onSkip={() => setSkipped(true)} />
      </View>
    );
  }

  // One-time gate — username, birthday (checked against the minimum age), and a bio —
  // before either a fresh account or a sample-mode explorer reaches the app.
  if (!state.onboarded) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        <Onboarding />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  cover: { backgroundColor: c.app, zIndex: 40 },
  wordmark: {
    color: c.textFaint,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
    marginTop: s[7],
  },
});
