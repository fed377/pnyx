import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Btn, Chip } from "@/components/Primitives";
import { useToast } from "@/components/Toast";
import { GRID_LIST } from "@/lib/grids";
import type { GridId } from "@/lib/types";
import { useHotTakes } from "@/state/useHotTakes";
import { useStore } from "@/state/store";
import { c, display, f, r, s, squircle } from "@/theme/tokens";

const MAX = 220;

export default function HotTakeComposer() {
  const { state } = useStore();
  const { post } = useHotTakes();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<GridId | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (state.profile.tier !== "speaker") {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + s[2] }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.headerSide}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New hot take</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.content}>
          <View style={styles.gate}>
            <Icon name="lock" size={22} color={c.text} />
            <Text style={styles.gateTitle}>Only Speakers can post</Text>
            <Text style={styles.gateBody}>
              A hot take is a public opinion, same as any other post — that&apos;s reserved for the Speaker tier.
            </Text>
            <Btn label="Change my visibility" variant="accent" onPress={() => router.push("/settings")} />
          </View>
        </View>
      </View>
    );
  }

  const canPost = category !== null && text.trim().length >= 8 && !busy;

  const submit = async () => {
    const body = text.trim();
    if (!canPost || !category) return;
    setBusy(true);
    try {
      await post(category, body);
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + s[2] }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.headerSide}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New hot take</Text>
        <Pressable
          onPress={() => void submit()}
          disabled={!canPost}
          accessibilityRole="button"
          accessibilityLabel="Post"
        >
          <Text style={[styles.headerSide, styles.headerPost, !canPost && styles.headerPostDisabled]}>
            {busy ? "Posting…" : "Post"}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.warn}>
          <Icon name="filter" size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnHead}>Say it, then let it go.</Text>
            <Text style={styles.warnBody}>
              A hot take disappears after 14 hours and no one can vote on it — it&apos;s the one place in PNYX to be
              loud without moving your score.
            </Text>
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Which grid is this?</Text>
          <View style={styles.chipRow}>
            {GRID_LIST.map((grid) => (
              <Chip key={grid.id} label={grid.label} selected={category === grid.id} onPress={() => setCategory(grid.id)} />
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Your take</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX}
            placeholder="Say what you really think."
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Your take"
            style={styles.textarea}
          />
          <Text style={styles.counter}>{MAX - text.length} characters left</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: s[4],
    paddingBottom: s[2],
  },
  headerTitle: { color: c.text, fontSize: f.md, fontFamily: display.semibold },
  headerSide: { color: c.textDim, fontSize: f.sm, minWidth: 50 },
  headerPost: { color: c.text, fontWeight: "600", textAlign: "right" },
  headerPostDisabled: { color: c.textFaint },
  content: { padding: s[4], gap: s[4] },
  warn: {
    flexDirection: "row",
    gap: s[3],
    padding: s[4],
    borderRadius: r.lg,
    backgroundColor: c.text,
    ...squircle,
  },
  warnHead: { color: c.app, fontSize: f.md, fontFamily: display.semibold },
  warnBody: { color: "rgba(255,255,255,0.7)", fontSize: f.xs, lineHeight: 17, marginTop: 2 },
  fieldLabel: { color: c.text, fontSize: f.sm, fontWeight: "600", marginBottom: s[2] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: s[2] },
  textarea: {
    color: c.text,
    fontSize: f.md,
    fontFamily: display.regular,
    minHeight: 100,
    textAlignVertical: "top",
    padding: s[3],
    borderRadius: r.md,
    backgroundColor: c.surface,
    ...squircle,
  },
  counter: { color: c.textFaint, fontSize: f.xs, textAlign: "right", marginTop: s[2] },
  gate: {
    alignItems: "flex-start",
    gap: s[3],
    padding: s[5],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: r.lg,
    ...squircle,
  },
  gateTitle: { color: c.text, fontSize: f.lg, fontWeight: "600" },
  gateBody: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
});
