import { StyleSheet, Text, View } from "react-native";
import { friendVotes, POWER_LABEL } from "@/lib/feed";
import type { Content, Person, VotePower } from "@/lib/types";
import { useFriendVotes } from "@/state/useFriendVotes";
import { c, f, hexToRgba, r, s, squircle } from "@/theme/tokens";
import { Avatar } from "./Avatar";

// "like"/"dislike" are a lighter tint of the same "love"/"hate" hue (c.up /
// c.down), derived rather than hand-picked so the two rows in the bar always
// share one source color.
const SEGMENTS = [
  { key: "love", label: "Loved", color: c.up },
  { key: "like", label: "Liked", color: hexToRgba(c.up, 0.45) },
  { key: "dislike", label: "Disliked", color: hexToRgba(c.down, 0.45) },
  { key: "hate", label: "Hated", color: c.down },
] as const;

/** Revealed only after the user votes (spec §6.2). */
export function VoteResult({
  content,
  friends,
  myVote,
  onDark = false,
}: {
  content: Content;
  friends: Person[];
  myVote: VotePower;
  onDark?: boolean;
}) {
  // Real cast votes in remote mode; the affinity-based guess only stands in
  // offline, where there's no real vote to look up at all.
  const real = useFriendVotes(content.id);
  const votes = (real ?? friendVotes(content, friends.slice(0, 5))).slice(0, 5);

  return (
    <View style={[styles.wrap, onDark && { backgroundColor: "#14141c" }]}>
      <View style={styles.head}>
        <Text style={styles.title}>How everyone voted</Text>
        <Text style={styles.you}>You · {POWER_LABEL[myVote]}</Text>
      </View>

      <View style={styles.bar}>
        {SEGMENTS.map((seg) => (
          <View
            key={seg.key}
            style={{ width: `${content.globalSplit[seg.key]}%`, backgroundColor: seg.color, height: "100%" }}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {SEGMENTS.map((seg) => (
          <View key={seg.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendText}>
              {seg.label} <Text style={styles.legendNum}>{content.globalSplit[seg.key]}%</Text>
            </Text>
          </View>
        ))}
      </View>

      {votes.length > 0 && (
        <View style={styles.friends}>
          <Text style={styles.friendsLabel}>Your circle</Text>
          <View style={styles.friendsRow}>
            {votes.map(({ person, power }) => (
              <View key={person.id} style={styles.friend}>
                <Avatar name={person.name} positions={person.positions} size={26} badge={false} photoUrl={person.avatarUrl} />
                <Text style={[styles.friendVote, { color: power > 0 ? c.up : c.down }]}>{POWER_LABEL[power]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: r.md,
    backgroundColor: c.surface,
    paddingHorizontal: s[4],
    paddingTop: s[3],
    paddingBottom: s[4],
    gap: s[3],
    ...squircle,
  },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: s[2] },
  title: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1.1, textTransform: "uppercase" },
  you: { color: c.textDim, fontSize: f.xs },
  bar: { flexDirection: "row", height: 8, borderRadius: r.full, overflow: "hidden", backgroundColor: c.surface3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: s[1], columnGap: s[4] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: r.full },
  legendText: { color: c.textDim, fontSize: f.xs },
  legendNum: { color: c.text, fontWeight: "600" },
  friends: { borderTopWidth: 1, borderTopColor: c.lineSoft, paddingTop: s[3] },
  friendsLabel: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1.1, textTransform: "uppercase" },
  friendsRow: { flexDirection: "row", flexWrap: "wrap", gap: s[3], marginTop: s[2] },
  friend: { flexDirection: "row", alignItems: "center", gap: 6 },
  friendVote: { fontSize: f.xs },
});
