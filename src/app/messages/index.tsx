import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AlignmentPill } from "@/components/Alignment";
import { AnimatedPressable, enterDelay } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Chrome";
import { POWER_LABEL } from "@/lib/feed";
import { timeAgo } from "@/lib/format";
import { ORIGIN } from "@/lib/algorithm";
import { useConversations } from "@/state/useConversations";
import { useStore } from "@/state/store";
import { c, f, s } from "@/theme/tokens";

export default function MessagesScreen() {
  const { alignmentWith, peopleById } = useStore();
  const { items, loading } = useConversations();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <PageHeader title="Messages" centered />
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: s[6] }} color={c.textFaint} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.map((convo, i) => {
            const person = peopleById[convo.personId];
            const name = person?.name ?? "Someone";
            const last = convo.messages[convo.messages.length - 1];
            return (
              <Animated.View key={convo.id} entering={FadeInDown.duration(240).delay(enterDelay(i))}>
                <AnimatedPressable
                  scaleTo={0.98}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                  accessibilityRole="link"
                  accessibilityLabel={`Open conversation with ${name}`}
                  onPress={() => router.push({ pathname: "/messages/[id]", params: { id: convo.personId } })}
                >
                  <Avatar name={name} positions={person?.positions ?? ORIGIN} size={46} photoUrl={person?.avatarUrl} />
                  <View style={styles.body}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{name}</Text>
                      {person && <AlignmentPill value={alignmentWith(person)} muted />}
                    </View>
                    <Text style={styles.last} numberOfLines={1}>
                      {last
                        ? (last.text ?? `Shared a post · ${last.vote ? POWER_LABEL[last.vote] : "no vote"}`)
                        : "Say hello"}
                    </Text>
                  </View>
                  {last && <Text style={styles.time}>{timeAgo(last.at)}</Text>}
                </AnimatedPressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7] },
  row: { flexDirection: "row", alignItems: "center", gap: s[3], paddingVertical: s[3] },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.lineSoft },
  body: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: s[2] },
  name: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  last: { color: c.textFaint, fontSize: f.xs },
  time: { color: c.textFaint, fontSize: 10 },
});
