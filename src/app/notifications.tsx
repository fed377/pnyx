import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AnimatedPressable, enterDelay } from "@/components/AnimatedPressable";
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
        {NOTIFICATIONS.map((n, i) => {
          const person = PEOPLE_BY_ID[n.personId];
          return (
            <Animated.View key={n.id} entering={FadeInDown.duration(240).delay(enterDelay(i))}>
              <AnimatedPressable
                scaleTo={0.98}
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
              </AnimatedPressable>
            </Animated.View>
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
