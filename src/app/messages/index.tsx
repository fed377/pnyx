import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlignmentPill } from "@/components/Alignment";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Chrome";
import { CONVERSATIONS, PEOPLE_BY_ID } from "@/lib/data";
import { POWER_LABEL } from "@/lib/feed";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/state/store";
import { c, f, s } from "@/theme/tokens";

export default function MessagesScreen() {
  const { alignmentWith } = useStore();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <PageHeader title="Messages" />
      <ScrollView contentContainerStyle={styles.content}>
        {CONVERSATIONS.map((convo) => {
          const person = PEOPLE_BY_ID[convo.personId];
          const last = convo.messages[convo.messages.length - 1];
          return (
            <Pressable
              key={convo.id}
              style={styles.row}
              accessibilityRole="link"
              accessibilityLabel={`Open conversation with ${person.name}`}
              onPress={() => router.push({ pathname: "/messages/[id]", params: { id: convo.id } })}
            >
              <Avatar name={person.name} positions={person.positions} size={46} />
              <View style={styles.body}>
                <Text style={styles.name}>{person.name}</Text>
                <Text style={styles.last} numberOfLines={1}>
                  {last.text ?? `Shared a post · ${last.vote ? POWER_LABEL[last.vote] : "no vote"}`}
                </Text>
              </View>
              <View style={styles.side}>
                <AlignmentPill value={alignmentWith(person)} muted />
                <Text style={styles.time}>{timeAgo(last.at)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7] },
  row: { flexDirection: "row", alignItems: "center", gap: s[3], paddingVertical: s[3], paddingHorizontal: s[2] },
  body: { flex: 1 },
  name: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  last: { color: c.textFaint, fontSize: f.xs },
  side: { alignItems: "flex-end", gap: 4 },
  time: { color: c.textFaint, fontSize: 10 },
});
