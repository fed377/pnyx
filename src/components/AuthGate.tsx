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
  const { hydrated, state, dispatch } = useStore();

  // Reading the stored session, or the local store: cover the app so no
  // content — or the onboarding gate below, decided from a stale default — flashes past.
  if (!ready || !hydrated) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        <Text style={styles.wordmark}>PNYX</Text>
      </View>
    );
  }

  // `skipped` lives in the store (not local state) specifically so "forget"/log
  // out resets it too — otherwise logging out fell straight through to
  // Onboarding instead of back to this sign-in screen.
  const signedInOrExploring = !configured || session !== null || state.skipped;

  if (!signedInOrExploring) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        <SignIn onSkip={() => dispatch({ type: "skip" })} />
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
