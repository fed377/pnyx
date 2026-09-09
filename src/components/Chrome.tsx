import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NOTIFICATIONS } from "@/lib/data";
import { useStore } from "@/state/store";
import { c, f, s } from "@/theme/tokens";
import { Icon } from "./Icon";
import { IconBtn } from "./Primitives";

/** Wordmark plus the persistent tools from spec section 6. */
export function TopBar({ showBell = false }: { showBell?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accent } = useStore();

  return (
    <View style={[styles.topbar, { paddingTop: insets.top + s[2] }]}>
      <Text style={styles.wordmark}>PNYX</Text>
      <View style={styles.tools}>
        {showBell && (
          <IconBtn
            name="bell"
            label="Notifications"
            onPress={() => router.push("/notifications")}
            badge={NOTIFICATIONS.length}
          />
        )}
        <IconBtn name="settings" label="Settings" onPress={() => router.push("/settings")} />
        <IconBtn name="stats" label="Statistics" onPress={() => router.push("/stats")} />
        <IconBtn name="plus" label="Contribute a post" color={accent} onPress={() => router.push("/contribute")} />
        <IconBtn name="message" label="Messages" onPress={() => router.push("/messages")} />
      </View>
    </View>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.pagehead, { paddingTop: insets.top + s[2] }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.back}
      >
        <Icon name="back" size={20} color={c.textDim} />
      </Pressable>
      <Text style={styles.pageTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.action}>{action}</View>
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
    backgroundColor: c.app,
    borderBottomWidth: 1,
    borderBottomColor: c.lineSoft,
  },
  wordmark: { color: c.text, fontSize: 17, fontWeight: "700", letterSpacing: 4 },
  tools: { flexDirection: "row", alignItems: "center" },
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
  pageTitle: { color: c.text, flex: 1, fontSize: f.lg, fontWeight: "600" },
  action: { paddingRight: s[2] },
});
