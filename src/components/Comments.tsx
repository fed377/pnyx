import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { timeAgo } from "@/lib/format";
import type { Content } from "@/lib/types";
import { useAuthor } from "@/state/useAuthor";
import { useComments } from "@/state/useComments";
import type { LiveComment } from "@/state/useComments";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

const REPORT_REASONS = ["Spam", "Harassment or abuse", "Copyright", "Something else"] as const;

function reportPost(contentId: string, reportContent: (contentId: string, reason: string) => Promise<void>) {
  Alert.alert("Report this post", "What's wrong with it?", [
    ...REPORT_REASONS.map((reason) => ({
      text: reason,
      onPress: () => {
        reportContent(contentId, reason)
          .then(() => Alert.alert("Reported", "Thanks — we'll take a look."))
          .catch(() => Alert.alert("Couldn't send that", "Please try again."));
      },
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}

function CommentRow({ cm, onVote }: { cm: LiveComment; onVote: (commentId: string, power: 1 | -1) => void }) {
  const author = useAuthor(cm.authorId);
  const v = cm.myVote;
  return (
    <View style={styles.comment}>
      <Avatar name={author.name} positions={author.positions} size={32} badge={false} photoUrl={author.avatarUrl} />
      <View style={styles.body}>
        <Text style={styles.who}>
          {author.isMe ? "You" : author.name} <Text style={styles.time}>{timeAgo(cm.at)}</Text>
        </Text>
        <Text style={styles.text}>{cm.text}</Text>
        <View style={styles.votes}>
          <Pressable
            onPress={() => onVote(cm.id, 1)}
            accessibilityRole="button"
            accessibilityLabel="Agree with this comment"
            style={styles.voteBtn}
          >
            <Icon name="thumbUp" size={14} color={v === 1 ? c.up : c.textFaint} filled={v === 1} />
            <Text style={[styles.voteNum, v === 1 && { color: c.up }]}>{cm.up}</Text>
          </Pressable>
          <Pressable
            onPress={() => onVote(cm.id, -1)}
            accessibilityRole="button"
            accessibilityLabel="Disagree with this comment"
            style={styles.voteBtn}
          >
            <Icon name="thumbDown" size={14} color={v === -1 ? c.down : c.textFaint} filled={v === -1} />
            <Text style={[styles.voteNum, v === -1 && { color: c.down }]}>{cm.down}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Comments are votable too (spec section 5) — real per-user votes, changeable
 * and toggle-off-able, backed by the server in remote mode. */
export function CommentsSheet({
  content,
  open,
  onClose,
}: {
  content: Content;
  open: boolean;
  onClose: () => void;
}) {
  const { items: all, loading, addComment, castVote } = useComments(content.id, content.comments, content.createdAt);
  const { reportContent } = useStore();
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void addComment(text);
  };

  return (
    <Sheet
      open={open}
      title={`${all.length} repl${all.length === 1 ? "y" : "ies"}`}
      onClose={onClose}
      closeLabel="Done"
      floating
    >
      {loading && all.length === 0 ? (
        <ActivityIndicator style={{ marginVertical: s[4] }} color={c.textFaint} />
      ) : (
        <View style={{ gap: s[4] }}>
          {all.map((cm) => (
            <CommentRow key={cm.id} cm={cm} onVote={(id, power) => void castVote(id, power)} />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => reportPost(content.id, reportContent)}
        accessibilityRole="button"
        accessibilityLabel="Report this post"
        style={styles.report}
      >
        <Text style={styles.reportText}>Report this post</Text>
      </Pressable>

      <View style={styles.form}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Reply"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Write a reply"
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Post reply"
          // 36x36 — 8pt under the 44pt iOS minimum, made up invisibly here
          // rather than by growing the visible button.
          hitSlop={4}
          style={[styles.send, !draft.trim() && { opacity: 0.4 }]}
        >
          <View style={{ transform: [{ rotate: "-90deg" }] }}>
            <Icon name="chevron" size={16} color={c.app} />
          </View>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  comment: { flexDirection: "row", gap: s[3], alignItems: "flex-start" },
  body: { flex: 1, gap: 2 },
  who: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  time: { color: c.textFaint, fontWeight: "400" },
  text: { color: c.text, fontSize: f.sm, lineHeight: 19 },
  votes: { flexDirection: "row", gap: s[4], marginTop: 4 },
  voteBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  voteNum: { color: c.textFaint, fontSize: f.xs, fontWeight: "600" },
  report: { alignItems: "center", marginTop: s[4] },
  reportText: { color: c.textFaint, fontSize: f.xs, textDecorationLine: "underline" },
  form: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[2],
    marginTop: s[5],
    paddingTop: s[4],
    borderTopWidth: 1,
    borderTopColor: c.lineSoft,
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
