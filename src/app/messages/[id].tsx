import { Redirect, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlignmentPill } from "@/components/Alignment";
import { PageHeader } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { Media } from "@/components/Media";
import { CONTENT_BY_ID, CONVERSATIONS, ME_ID, PEOPLE_BY_ID } from "@/lib/data";
import { POWER_LABEL } from "@/lib/feed";
import { timeAgo } from "@/lib/format";
import type { ChatMessage, VotePower } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, r, s } from "@/theme/tokens";

/** A forwarded post carries the sender's vote on it (spec section 6.7). */
function ForwardedPost({ contentId, vote }: { contentId: string; vote?: VotePower }) {
  const content = CONTENT_BY_ID[contentId];
  if (!content) return null;
  const author = PEOPLE_BY_ID[content.authorId];

  return (
    <View style={styles.fwd}>
      <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} ratio={16 / 9} rounded={false} />
      <Text style={styles.fwdText}>{content.text}</Text>
      <Text style={styles.fwdMeta}>
        @{author.handle}
        {vote !== undefined && (
          <Text style={{ color: vote > 0 ? c.up : c.down }}> · they {POWER_LABEL[vote].toLowerCase()} it</Text>
        )}
      </Text>
    </View>
  );
}

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alignmentWith, accent, accentSoft, accentLine } = useStore();
  const insets = useSafeAreaInsets();
  const [extra, setExtra] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const convo = useMemo(() => CONVERSATIONS.find((x) => x.id === id), [id]);

  if (!convo) return <Redirect href="/messages" />;

  const person = PEOPLE_BY_ID[convo.personId];
  const messages = [...convo.messages, ...extra];

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setExtra((x) => [...x, { id: `local-${Date.now()}`, from: ME_ID, text, at: Date.now() }]);
    setDraft("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <PageHeader title={person.name} action={<AlignmentPill value={alignmentWith(person)} />} />

      <ScrollView contentContainerStyle={styles.list}>
        {messages.map((m) => {
          const mine = m.from === ME_ID;
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                mine && { alignSelf: "flex-end", backgroundColor: accentSoft, borderColor: accentLine },
              ]}
            >
              {m.contentId && <ForwardedPost contentId={m.contentId} vote={m.vote} />}
              {m.text && <Text style={styles.bubbleText}>{m.text}</Text>}
              <Text style={styles.time}>{timeAgo(m.at)}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + s[3] }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${person.name.split(" ")[0]}`}
          placeholderTextColor={c.textFaint}
          accessibilityLabel={`Message ${person.name}`}
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
          <Icon name="send" size={18} color={accent} />
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
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  bubbleText: { color: c.text, fontSize: f.sm, lineHeight: 19 },
  time: { color: c.textFaint, fontSize: 10, marginTop: 4 },
  fwd: { marginBottom: s[2], borderRadius: r.sm, overflow: "hidden", borderWidth: 1, borderColor: c.line },
  fwdText: { color: c.text, fontSize: f.xs, lineHeight: 17, paddingHorizontal: s[3], paddingTop: s[2] },
  fwdMeta: { color: c.textFaint, fontSize: 10, paddingHorizontal: s[3], paddingBottom: s[2], paddingTop: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[2],
    paddingHorizontal: s[4],
    paddingTop: s[3],
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.app,
  },
  input: {
    flex: 1,
    color: c.text,
    fontSize: f.sm,
    paddingHorizontal: s[3],
    paddingVertical: 10,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface2,
  },
  send: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
