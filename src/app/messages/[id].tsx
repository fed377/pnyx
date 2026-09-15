import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlignmentPill } from "@/components/Alignment";
import { PageHeader } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { Media } from "@/components/Media";
import { POWER_LABEL } from "@/lib/feed";
import type { VotePower } from "@/lib/types";
import { useAuthor } from "@/state/useAuthor";
import { useConversation } from "@/state/useConversation";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";

/** A forwarded post carries the sender's vote on it (spec section 6.7). */
function ForwardedPost({ contentId, vote, senderName }: { contentId: string; vote?: VotePower; senderName: string }) {
  const { contentById } = useStore();
  const content = contentById[contentId];
  const author = useAuthor(content?.authorId ?? "");
  if (!content) return null;

  return (
    <View style={styles.fwd}>
      <View style={styles.fwdHead}>
        <Media
          id={content.id}
          scores={content.scores}
          mediaUrl={content.mediaUrl}
          ratio={1}
          rounded
          style={styles.fwdThumb}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.fwdName}>{author.name}</Text>
          <Text style={styles.fwdText} numberOfLines={2}>
            {content.text}
          </Text>
        </View>
      </View>
      {vote !== undefined && (
        <View style={[styles.fwdPill, { backgroundColor: vote > 0 ? c.upSoft : c.downSoft }]}>
          <Icon name={vote > 0 ? "heart" : "heartBreak"} size={12} color={vote > 0 ? c.up : c.down} filled />
          <Text style={styles.fwdPillText}>
            {senderName} {POWER_LABEL[vote].toLowerCase()} this
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alignmentWith, myId, peopleById } = useStore();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");

  const { messages, loading, found, send: sendMessage } = useConversation(id ?? "");

  if (!id || !found) return <Redirect href="/messages" />;

  const person = peopleById[id];
  const name = person?.name ?? "Someone";

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void sendMessage({ text });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <PageHeader title={name} centered action={person && <AlignmentPill value={alignmentWith(person)} />} />

      {loading && messages.length === 0 ? (
        <ActivityIndicator style={{ marginTop: s[6] }} color={c.textFaint} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {messages.map((m) => {
            const mine = m.from === myId;
            return (
              <View key={m.id} style={[styles.bubble, mine && styles.bubbleMine]}>
                {m.contentId && (
                  <ForwardedPost contentId={m.contentId} vote={m.vote} senderName={name.split(" ")[0]} />
                )}
                {m.text && <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.composer, { paddingBottom: insets.bottom + s[3] }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={c.textFaint}
          accessibilityLabel={`Message ${name}`}
          style={styles.input}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[styles.send, !draft.trim() && { opacity: 0.4 }]}
        >
          <View style={{ transform: [{ rotate: "-90deg" }] }}>
            <Icon name="chevron" size={16} color={c.app} />
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  list: { padding: s[4], gap: s[3] },
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "84%",
    padding: s[3],
    borderRadius: r.md,
    backgroundColor: c.surface,
    ...squircle,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: c.text },
  bubbleText: { color: c.text, fontSize: f.sm, lineHeight: 19 },
  bubbleTextMine: { color: c.app },
  fwd: { gap: s[2] },
  fwdHead: { flexDirection: "row", gap: s[2] },
  fwdThumb: { width: 44, height: 44 },
  fwdName: { color: c.text, fontSize: f.xs, fontWeight: "600" },
  fwdText: { color: c.textDim, fontSize: f.xs, lineHeight: 17, marginTop: 1 },
  fwdPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: s[2],
    height: 24,
    borderRadius: r.full,
  },
  fwdPillText: { color: c.text, fontSize: 11, fontWeight: "600" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[2],
    paddingHorizontal: s[4],
    paddingTop: s[3],
    backgroundColor: c.app,
  },
  input: {
    flex: 1,
    color: c.text,
    fontSize: f.sm,
    paddingHorizontal: s[4],
    paddingVertical: 10,
    borderRadius: r.full,
    backgroundColor: c.surface2,
    ...squircle,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: r.full,
    backgroundColor: c.text,
    alignItems: "center",
    justifyContent: "center",
  },
});
