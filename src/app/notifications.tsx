import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Chrome";
import { NOTIFICATIONS, PEOPLE_BY_ID } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { c, f, s } from "@/theme/tokens";

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <PageHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.content}>
        {NOTIFICATIONS.map((n) => {
          const person = PEOPLE_BY_ID[n.personId];
          return (
            <Pressable
              key={n.id}
              style={styles.row}
              accessibilityRole="link"
              accessibilityLabel={`${person.name} ${n.text}`}
              onPress={() => router.push({ pathname: "/u/[id]", params: { id: person.id } })}
            >
              <Avatar name={person.name} positions={person.positions} size={40} />
              <Text style={styles.text}>
                <Text style={styles.name}>{person.name}</Text> {n.text}
              </Text>
              <Text style={styles.time}>{timeAgo(n.at)}</Text>
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
  text: { flex: 1, color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  name: { color: c.text, fontWeight: "600" },
  time: { color: c.textFaint, fontSize: f.xs },
});
