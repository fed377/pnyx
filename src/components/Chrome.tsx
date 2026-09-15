import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "@/state/useNotifications";
import { c, display, f, r, s, squircle } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Icon } from "./Icon";
import { LiquidGlassSurface } from "./LiquidGlass";
import { IconBtn } from "./Primitives";

/** Wordmark plus the persistent tools from spec section 6. */
export function TopBar({
  showNotifications = false,
  showWordmark = true,
  wordmark = "pnyx",
  tint = "light",
}: {
  showNotifications?: boolean;
  showWordmark?: boolean;
  /** Own Profile swaps this for the signed-in person's own first name. */
  wordmark?: string;
  /** "dark" sits over media (Feed's reels) — light-tinted glass barely
   * frosts against dark video, so this flips both the glass and the icon
   * color for real contrast instead of reading as a flat solid pill. */
  tint?: "light" | "dark";
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onDark = tint === "dark";
  const iconColor = onDark ? "#fff" : c.text;
  // Only fetched when the badge is actually shown — no point paying for a
  // notifications round-trip on every screen that renders a bare TopBar.
  const { items: notifications } = useNotifications(showNotifications);

  return (
    <View style={[styles.topbar, { paddingTop: insets.top + s[2] }]}>
      {showWordmark ? <Text style={[styles.wordmark, onDark && { color: "#fff" }]}>{wordmark}</Text> : <View />}
      <View style={styles.tools}>
        {/* isInteractive glass has an intermittent bug where it briefly renders
            solid black instead of its lens effect; static glass avoids it. */}
        <LiquidGlassSurface radius={r.full} tint={tint} />
        {showNotifications && (
          <IconBtn
            name="heart"
            label="Notifications"
            onPress={() => router.push("/notifications")}
            badge={notifications.length}
            color={iconColor}
          />
        )}
        <IconBtn name="stats" label="Statistics" onPress={() => router.push("/stats")} color={iconColor} />
        <IconBtn name="plus" label="Contribute a post" onPress={() => router.push("/contribute")} color={iconColor} />
        <IconBtn name="message" label="Messages" onPress={() => router.push("/messages")} color={iconColor} />
        <IconBtn name="settings" label="Settings" onPress={() => router.push("/settings")} color={iconColor} />
      </View>
    </View>
  );
}

export function PageHeader({
  title,
  action,
  centered = false,
}: {
  title: string;
  action?: ReactNode;
  /** A circular back button and a title centered in the full row, rather
   * than left-aligned next to the back arrow — the Settings-style header. */
  centered?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.pagehead, { paddingTop: insets.top + s[2] }]}>
      <AnimatedPressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        scaleTo={0.88}
        style={[styles.back, centered && styles.backCircle]}
      >
        <Icon name="back" size={20} color={c.text} />
      </AnimatedPressable>
      <Text style={[styles.pageTitle, centered && styles.pageTitleCentered]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.action, centered && { minWidth: 36 }]}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: s[4],
    paddingBottom: s[2],
    backgroundColor: "transparent",
  },
  wordmark: { color: c.text, fontSize: 20, fontFamily: display.bold, letterSpacing: 0.2 },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: r.full,
    paddingHorizontal: s[1],
    overflow: "hidden",
    ...squircle,
  },
  pagehead: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[2],
    paddingHorizontal: s[3],
    paddingBottom: s[2],
    backgroundColor: c.app,
    borderBottomWidth: 1,
    borderBottomColor: c.lineSoft,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backCircle: {
    borderRadius: r.full,
    backgroundColor: c.surface,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    ...squircle,
  },
  pageTitle: { color: c.text, flex: 1, fontSize: f.lg, fontFamily: display.semibold },
  pageTitleCentered: { textAlign: "center" },
  action: { paddingRight: s[2] },
});
