import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle, TAB_BAR_CLEARANCE } from "@/theme/tokens";

const AUTO_DISMISS_MS: Partial<Record<"posted" | "failed", number>> = {
  posted: 2500,
  failed: 5000,
};

/**
 * Posting runs in the background now (Contribute navigates back the instant
 * you tap Post — see its own comment) — this is what shows progress on
 * whatever screen you land back on, in one consistent place regardless of
 * which screen that is.
 */
export function PostStatusSnackbar() {
  const { postStatus, postError, dismissPostStatus } = useStore();
  const fade = useRef(new Animated.Value(0)).current;
  const visible = postStatus !== "idle";

  useEffect(() => {
    if (!visible) return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, fade]);

  // "uploading" has no timer — it clears when the status actually changes,
  // not on a fixed clock, since the upload's real duration is unknown.
  useEffect(() => {
    const ms = postStatus === "posted" || postStatus === "failed" ? AUTO_DISMISS_MS[postStatus] : undefined;
    if (!ms) return;
    const t = setTimeout(dismissPostStatus, ms);
    return () => clearTimeout(t);
  }, [postStatus, dismissPostStatus]);

  if (!visible) return null;

  const label =
    postStatus === "uploading"
      ? "Posting your reel…"
      : postStatus === "posted"
        ? "Posted. It's in the queue for moderation."
        : (postError ?? "Could not post that");

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
    >
      <Pressable
        onPress={postStatus === "uploading" ? undefined : dismissPostStatus}
        accessibilityRole={postStatus === "uploading" ? undefined : "button"}
        accessibilityLabel={postStatus === "uploading" ? undefined : "Dismiss"}
        accessibilityLiveRegion="polite"
        style={[styles.bar, postStatus === "failed" && styles.barError]}
      >
        {postStatus === "uploading" && <ActivityIndicator size="small" color={c.app} style={styles.spinner} />}
        <Text style={[styles.text, postStatus === "failed" && styles.textError]} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: s[4],
    right: s[4],
    bottom: TAB_BAR_CLEARANCE,
    zIndex: 35,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s[2],
    paddingVertical: s[3],
    paddingHorizontal: s[4],
    borderRadius: r.full,
    backgroundColor: c.text,
    ...squircle,
  },
  barError: { backgroundColor: c.down },
  spinner: { marginRight: 2 },
  text: { color: c.app, fontSize: f.sm, fontWeight: "600", textAlign: "center", flexShrink: 1 },
  textError: { color: "#fff" },
});
