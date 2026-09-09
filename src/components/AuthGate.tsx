import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/state/session";
import { c, s } from "@/theme/tokens";
import { SignIn } from "./SignIn";

/**
 * Sits on top of the navigator rather than replacing it. Gating the tree on an
 * async session read would leave the app stranded on the splash screen, because
 * expo-router only hides it once the navigator mounts.
 */
export function AuthGate() {
  const { ready, session, configured } = useSession();
  const [skipped, setSkipped] = useState(false);

  // Reading the stored session: cover the app so no content flashes past.
  if (!ready) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        <Text style={styles.wordmark}>PNYX</Text>
      </View>
    );
  }

  // No backend configured, already signed in, or explicitly exploring offline.
  if (!configured || session || skipped) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.cover]}>
      <SignIn onSkip={() => setSkipped(true)} />
    </View>
  );
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
