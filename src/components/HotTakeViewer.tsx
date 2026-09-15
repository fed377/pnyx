import { useRouter } from "expo-router";
import { Share, StyleSheet, Text, View } from "react-native";
import { compactCount, timeAgoLong } from "@/lib/format";
import { GRIDS, nearestPoint } from "@/lib/grids";
import type { HotTake, Person } from "@/lib/types";
import { display, f, r, s, squircle, TAB_BAR_CLEARANCE } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { StoryShell } from "./StoryShell";
import { useToast } from "./Toast";

export function HotTakeViewer({
  takes,
  index,
  onIndexChange,
  peopleById,
  onClose,
}: {
  takes: HotTake[];
  index: number;
  onIndexChange: (i: number) => void;
  peopleById: Record<string, Person>;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const take = takes[index];
  const author = take ? peopleById[take.authorId] : undefined;

  if (!take || !author) return null;
  const type = nearestPoint("values", author.positions.values);

  const share = async () => {
    try {
      await Share.share({ message: `"${take.text}" — @${author.handle} on PNYX` });
    } catch {
      toast("Couldn't share that one");
    }
  };

  return (
    <StoryShell
      open
      count={takes.length}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
      center={<Text style={styles.take}>{take.text}</Text>}
    >
      <View style={[styles.card, { marginBottom: TAB_BAR_CLEARANCE }]}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{GRIDS[take.category].label}</Text>
        </View>

        <AnimatedPressable
          scaleTo={0.97}
          style={styles.byline}
          accessibilityRole="link"
          accessibilityLabel={`Open ${author.name}'s profile`}
          onPress={() => {
            onClose();
            router.push({ pathname: "/u/[id]", params: { id: author.id } });
          }}
        >
          <Avatar name={author.name} positions={author.positions} size={34} badge={false} photoUrl={author.avatarUrl} />
          <View>
            <Text style={styles.name}>{author.name}</Text>
            <Text style={styles.sub}>{type.name} · expires in 14h</Text>
          </View>
        </AnimatedPressable>

        <View style={styles.actions}>
          <View style={styles.pill}>
            <Icon name="thumbUp" size={16} color="#fff" />
            <Text style={styles.pillCount}>{compactCount(take.up)}</Text>
          </View>
          <View style={styles.pill}>
            <Icon name="thumbDown" size={16} color="#fff" />
            <Text style={styles.pillCount}>{compactCount(take.down)}</Text>
          </View>
          <View style={styles.pill}>
            <Icon name="comment" size={16} color="#fff" />
            <Text style={styles.pillCount}>{compactCount(take.comments)}</Text>
          </View>
          <AnimatedPressable
            onPress={share}
            scaleTo={0.9}
            style={styles.pill}
            accessibilityRole="button"
            accessibilityLabel="Share this take"
          >
            <Icon name="share" size={16} color="#fff" />
          </AnimatedPressable>
        </View>

        <Text style={styles.timestamp}>{timeAgoLong(take.createdAt)}</Text>
      </View>
    </StoryShell>
  );
}

const styles = StyleSheet.create({
  take: {
    color: "#fff",
    fontSize: 30,
    fontFamily: display.bold,
    lineHeight: 36,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  card: {
    marginHorizontal: s[4],
    padding: s[4],
    borderRadius: r.lg,
    backgroundColor: "rgba(255,255,255,0.1)",
    gap: s[3],
    ...squircle,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: s[3],
    height: 26,
    borderRadius: r.full,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    ...squircle,
  },
  chipText: { color: "#fff", fontSize: f.xs, fontWeight: "600" },
  byline: { flexDirection: "row", alignItems: "center", gap: s[2] },
  name: { color: "#fff", fontSize: f.sm, fontFamily: display.semibold },
  sub: { color: "rgba(255,255,255,0.6)", fontSize: f.xs, marginTop: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: s[2] },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: s[3],
    borderRadius: r.full,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    ...squircle,
  },
  pillCount: { color: "#fff", fontSize: f.sm, fontWeight: "600" },
  timestamp: { color: "rgba(255,255,255,0.5)", fontSize: f.xs },
});
