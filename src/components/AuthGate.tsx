import { usePathname } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "@/state/session";
import { useStore } from "@/state/store";
import { c, s } from "@/theme/tokens";
import { Landing } from "./Landing";
import { SignIn } from "./SignIn";

/**
 * Sits on top of the navigator rather than replacing it. Gating the tree on an
 * async session read would leave the app stranded on the splash screen, because
 * expo-router only hides it once the navigator mounts.
 */
export function AuthGate() {
  const { ready, session, configured } = useSession();
  const { hydrated, state, dispatch } = useStore();
  const pathname = usePathname();
  // Resets on a fresh app launch (this component's own remount), not
  // persisted — the point is a first landing screen for this session, not a
  // once-ever onboarding flag.
  const [pastLanding, setPastLanding] = useState(false);

  // A password-recovery link opens this while signed out (the whole point of
  // forgetting your password) — it must never be covered by the sign-in
  // screen the way every other route is.
  if (pathname === "/auth-callback") return null;

  // Reading the stored session, or the local store: cover the app so no
  // content flashes past while either is still unresolved.
  if (!ready || !hydrated) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        <Text style={styles.wordmark}>PNYX</Text>
      </View>
    );
  }

  // `skipped` lives in the store (not local state) specifically so "forget"/log
  // out resets it too — otherwise logging out fell straight through past this
  // sign-in screen instead of landing back on it.
  const signedInOrExploring = !configured || session !== null || state.skipped;

  if (!signedInOrExploring) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]}>
        {pastLanding ? (
          <SignIn />
        ) : (
          <Landing onContinue={() => setPastLanding(true)} onSkip={() => dispatch({ type: "skip" })} />
        )}
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
