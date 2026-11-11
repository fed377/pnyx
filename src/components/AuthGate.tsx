import { usePathname } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig } from "react-native-reanimated";
import { useSession } from "@/state/session";
import { useStore } from "@/state/store";
import { duration, ease } from "@/theme/motion";
import { c } from "@/theme/tokens";
import { Landing } from "./Landing";
import { LaunchScreen } from "./Loading";
import { Onboarding } from "./Onboarding";
import { SignIn } from "./SignIn";

/**
 * Sits on top of the navigator rather than replacing it. Gating the tree on an
 * async session read would leave the app stranded on the splash screen, because
 * expo-router only hides it once the navigator mounts.
 */
export function AuthGate() {
  const { ready, session, configured } = useSession();
  const { hydrated, mode, profileLoaded, needsOnboarding } = useStore();
  const pathname = usePathname();
  // Resets on a fresh app launch (this component's own remount), not
  // persisted — the point is a first landing screen for this session, not a
  // once-ever onboarding flag.
  const [pastLanding, setPastLanding] = useState(false);

  // A password-recovery link opens this while signed out (the whole point of
  // forgetting your password) — it must never be covered by the sign-in
  // screen the way every other route is.
  const cover: "launch" | "landing" | "signin" | "welcome" | null =
    pathname === "/auth-callback"
      ? null
      : // Reading the stored session, or the local store: cover the app so no
        // content flashes past while either is still unresolved.
        !ready || !hydrated
        ? "launch"
        : // An account is the only way in — there is no browsing without one. (An
          // unconfigured build, with no API URL at all, is the offline dev setup and
          // has nothing to sign in to.)
          configured && session === null
          ? pastLanding
            ? "signin"
            : "landing"
          : // Signed in, but this session's real account data hasn't landed yet —
            // state.profile always holds *something* (the local sample persona by
            // default, or briefly a previous account's data right after switching
            // accounts, since the Stack/Tabs underneath never unmount). Covering here
            // stops any screen from flashing that stale data while GET /me is still in
            // flight, which on a cold Render instance can take tens of seconds.
            mode === "remote" && !profileLoaded
            ? "launch"
            : // A new account sees the welcome tour once, before the app itself.
              needsOnboarding
              ? "welcome"
              : null;

  // One opaque cover whose contents crossfade, so moving between launch,
  // landing and sign-in never shows the app through the gap, and the app is
  // revealed by the whole cover fading away. Skipped on the very first render:
  // at launch the cover must already be there when the splash screen lifts.
  return (
    <LayoutAnimationConfig skipEntering>
      {cover && (
        <Animated.View
          entering={FadeIn.duration(duration.slow).easing(ease.out)}
          exiting={FadeOut.duration(duration.slow).easing(ease.inOut)}
          style={[StyleSheet.absoluteFill, styles.cover]}
        >
          <Animated.View
            key={cover}
            entering={FadeIn.duration(duration.slow).easing(ease.out)}
            exiting={FadeOut.duration(duration.base).easing(ease.in)}
            style={StyleSheet.absoluteFill}
          >
            {cover === "launch" ? (
              <LaunchScreen />
            ) : cover === "landing" ? (
              <Landing onContinue={() => setPastLanding(true)} />
            ) : cover === "welcome" ? (
              <Onboarding mode="first" />
            ) : (
              <SignIn />
            )}
          </Animated.View>
        </Animated.View>
      )}
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: c.app, zIndex: 40 },
});
