import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "@/state/store";
import { c, f, r, s } from "@/theme/tokens";

/**
 * The app falls back to whatever it already has when the API is unreachable.
 * Failing silently makes that indistinguishable from an empty account, so say so.
 */
export function SyncBanner() {
  const { error, refresh, loading, mode } = useStore();
  const insets = useSafeAreaInsets();

  if (mode !== "remote" || !error) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 4 }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text} numberOfLines={2}>
          {error}
        </Text>
        <Pressable
          onPress={() => void refresh()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={styles.retry}
        >
          <Text style={styles.retryText}>{loading ? "…" : "Retry"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: s[3], right: s[3], zIndex: 30 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[3],
    paddingVertical: s[2],
    paddingHorizontal: s[3],
    borderRadius: r.md,
    backgroundColor: c.surface3,
    borderWidth: 1,
    borderColor: "rgba(229,98,111,0.45)",
  },
  text: { flex: 1, color: c.text, fontSize: f.xs, lineHeight: 16 },
  retry: { paddingHorizontal: s[2], paddingVertical: 2 },
  retryText: { color: c.down, fontSize: f.xs, fontWeight: "600" },
});
