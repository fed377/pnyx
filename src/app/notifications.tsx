import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AnimatedPressable, enterDelay } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { Media } from "@/components/Media";
import { ORIGIN } from "@/lib/algorithm";
import type { Notification } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import type { Content, Person } from "@/lib/types";
import { useNotifications } from "@/state/useNotifications";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";

const DAY_MS = 86_400_000;

/** The thumbnail/pill on the right — what kind depends on what happened. */
function Accessory({ n, content }: { n: Notification; content: Content | undefined }) {
  if (n.kind === "follow") {
    return (
      <View style={styles.pill}>
        <Text style={styles.pillText}>Following</Text>
      </View>
    );
  }
  if (n.kind === "alignment") {
    return (
      <View style={styles.pill}>
        <Text style={styles.pillText}>{n.pct}%</Text>
      </View>
    );
  }
  if (content) {
    return (
      <View style={styles.thumbClip}>
        <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} rounded={false} />
      </View>
    );
  }
  return (
    <View style={styles.iconTile}>
      <Icon name="comment" size={16} color={c.app} />
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { peopleById, contentById } = useStore();
  const { items, loading } = useNotifications();

  // A snapshot taken once, when the screen mounts — reading "now" fresh on
  // every render would be impure.
  const [now] = useState(() => Date.now());
  const { today, week } = useMemo(() => {
    const today: Notification[] = [];
    const week: Notification[] = [];
    for (const n of items) (now - n.at < DAY_MS ? today : week).push(n);
    return { today, week };
  }, [items, now]);

  const Row = ({ n, index }: { n: Notification; index: number }) => {
    const person: Person | undefined = peopleById[n.personId];
    const name = person?.name ?? "Someone";
    return (
      <Animated.View entering={FadeInDown.duration(240).delay(enterDelay(index))}>
        <AnimatedPressable
          scaleTo={0.98}
          style={styles.row}
          accessibilityRole="link"
          accessibilityLabel={`${name} ${n.text}`}
          onPress={() => person && router.push({ pathname: "/u/[id]", params: { id: person.id } })}
        >
          <Avatar
            name={name}
            positions={person?.positions ?? ORIGIN}
            size={40}
            badge={false}
            photoUrl={person?.avatarUrl}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>
              <Text style={styles.name}>{name}</Text> {n.text} <Text style={styles.time}>{timeAgo(n.at)}</Text>
            </Text>
          </View>
          <Accessory n={n} content={n.contentId ? contentById[n.contentId] : undefined} />
        </AnimatedPressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.screen}>
      <PageHeader title="Notifications" centered />
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: s[6] }} color={c.textFaint} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {today.length > 0 && (
            <View>
              <Text style={styles.section}>Today</Text>
              {today.map((n, i) => (
                <Row key={n.id} n={n} index={i} />
              ))}
            </View>
          )}
          {week.length > 0 && (
            <View>
              <Text style={styles.section}>This week</Text>
              {week.map((n, i) => (
                <Row key={n.id} n={n} index={today.length + i} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7], gap: s[4] },
  section: { color: c.text, fontSize: f.sm, fontWeight: "600", marginBottom: s[1] },
  row: { flexDirection: "row", alignItems: "center", gap: s[3], paddingVertical: s[3] },
  text: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  name: { color: c.text, fontWeight: "600" },
  time: { color: c.textFaint, fontSize: f.xs },
  thumbClip: { width: 44, height: 44, borderRadius: r.sm, overflow: "hidden", ...squircle },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: r.sm,
    backgroundColor: c.text,
    alignItems: "center",
    justifyContent: "center",
    ...squircle,
  },
  pill: {
    paddingHorizontal: s[3],
    height: 30,
    borderRadius: r.full,
    backgroundColor: c.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { color: c.text, fontSize: f.xs, fontWeight: "600" },
});
