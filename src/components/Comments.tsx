import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PEOPLE_BY_ID } from "@/lib/data";
import type { Comment, Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, mixHex, r, s, squircle } from "@/theme/tokens";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

/** Comments are votable too (spec section 5). Votes here stay local to the session. */
export function CommentsSheet({
  content,
  open,
  onClose,
}: {
  content: Content;
  open: boolean;
  onClose: () => void;
}) {
  const { state, positions, accent } = useStore();
  const [votes, setVotes] = useState<Record<string, 1 | -1>>({});
  const [added, setAdded] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  const all = [...added, ...content.comments];

  const cast = (id: string, dir: 1 | -1) =>
    setVotes((v) => {
      const next = { ...v };
      if (next[id] === dir) delete next[id];
      else next[id] = dir;
      return next;
    });

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setAdded((a) => [{ id: `local-${Date.now()}`, authorId: "me", text, up: 0, down: 0 }, ...a]);
    setDraft("");
  };

  return (
    <Sheet open={open} title={`${all.length} comment${all.length === 1 ? "" : "s"}`} onClose={onClose}>
      <View style={{ gap: s[4] }}>
        {all.map((cm) => {
          const mine = cm.authorId === "me";
          const person = mine ? null : PEOPLE_BY_ID[cm.authorId];
          const v = votes[cm.id];
          return (
            <View key={cm.id} style={styles.comment}>
              <Avatar
                name={mine ? state.profile.name : person!.name}
                positions={mine ? positions : person!.positions}
                size={32}
                badge={false}
              />
              <View style={styles.body}>
                <Text style={styles.who}>{mine ? "You" : `@${person!.handle}`}</Text>
                <Text style={styles.text}>{cm.text}</Text>
              </View>
              <View style={styles.votes}>
                <Pressable
                  onPress={() => cast(cm.id, 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Agree with this comment"
                  style={[styles.chip, v === 1 && { backgroundColor: mixHex(c.up, c.surface2, 0.3) }]}
                >
                  <Icon name="thumbUp" size={13} color={v === 1 ? c.up : c.textFaint} filled={v === 1} />
                  <Text style={[styles.chipNum, v === 1 && { color: c.up }]}>{cm.up + (v === 1 ? 1 : 0)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => cast(cm.id, -1)}
                  accessibilityRole="button"
                  accessibilityLabel="Disagree with this comment"
                  style={[styles.chip, v === -1 && { backgroundColor: mixHex(c.down, c.surface2, 0.3) }]}
                >
                  <Icon name="thumbDown" size={13} color={v === -1 ? c.down : c.textFaint} filled={v === -1} />
                  <Text style={[styles.chipNum, v === -1 && { color: c.down }]}>{cm.down + (v === -1 ? 1 : 0)}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.form}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Say what you actually think"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Write a comment"
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable
          onPress={submit}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          style={[styles.send, !draft.trim() && { opacity: 0.4 }]}
        >
          <Icon name="send" size={18} color={accent} />
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  comment: { flexDirection: "row", gap: s[3], alignItems: "flex-start" },
  body: { flex: 1 },
  who: { color: c.textFaint, fontSize: f.xs },
  text: { color: c.text, fontSize: f.sm, lineHeight: 19 },
  votes: { gap: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: r.full,
    backgroundColor: c.surface2,
  },
  chipNum: { color: c.textFaint, fontSize: f.xs },
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
    paddingHorizontal: s[3],
    paddingVertical: 10,
    borderRadius: r.sm,
    backgroundColor: c.surface2,
    ...squircle,
  },
  send: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
