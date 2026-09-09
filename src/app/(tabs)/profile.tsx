import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlignmentPill } from "@/components/Alignment";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/Chrome";
import { Btn, SectionTitle } from "@/components/Primitives";
import { ProfileView } from "@/components/ProfileView";

import type { Person } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, s } from "@/theme/tokens";

function AlignedRow({
  title,
  people,
  alignmentWith,
}: {
  title: string;
  people: Person[];
  alignmentWith: (p: Person) => number;
}) {
  const router = useRouter();
  if (people.length === 0) return null;

  return (
    <View>
      <SectionTitle>{title}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {people.map((p) => (
          <Pressable
            key={p.id}
            style={styles.item}
            accessibilityRole="link"
            accessibilityLabel={`Open ${p.name}'s profile`}
            onPress={() => router.push({ pathname: "/u/[id]", params: { id: p.id } })}
          >
            <Avatar name={p.name} positions={p.positions} size={48} />
            <Text style={styles.handle} numberOfLines={1}>
              {p.handle}
            </Text>
            <AlignmentPill value={alignmentWith(p)} muted />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ProfileScreen() {
  const { state, positions, unlocked, alignmentWith, isFollowing, people, reels, posts } = useStore();
  const router = useRouter();

  const seen = useMemo(() => [...reels, ...posts], [reels, posts]);
  const loved = useMemo(() => seen.filter((x) => state.reactions[x.id] === 2), [seen, state.reactions]);
  const hated = useMemo(() => seen.filter((x) => state.reactions[x.id] === -2), [seen, state.reactions]);

  const topFollowing = useMemo(
    () =>
      people.filter((p) => isFollowing(p.id))
        .sort((a, b) => alignmentWith(b) - alignmentWith(a))
        .slice(0, 5),
    [alignmentWith, isFollowing, people],
  );

  const topFollowers = useMemo(
    () =>
      people.filter((p) => p.follower)
        .sort((a, b) => alignmentWith(b) - alignmentWith(a))
        .slice(0, 5),
    [alignmentWith, people],
  );

  return (
    <View style={styles.screen}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileView
          name={state.profile.name}
          handle={state.profile.handle}
          pronouns={state.profile.pronouns}
          bio={state.profile.bio}
          city={state.profile.city}
          positions={positions}
          alignment={100}
          locked={!unlocked}
          loved={loved}
          hated={hated}
          posts={state.myPosts}
          actions={
            <>
              <Btn label="Edit profile" icon="settings" onPress={() => router.push("/settings")} />
              <Btn label="Statistics" icon="stats" onPress={() => router.push("/stats")} />
            </>
          }
          footer={
            <>
              <AlignedRow title="Most aligned you follow" people={topFollowing} alignmentWith={alignmentWith} />
              <AlignedRow title="Most aligned followers" people={topFollowers} alignmentWith={alignmentWith} />
            </>
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7] },
  row: { gap: s[4], paddingRight: s[4] },
  item: { alignItems: "center", gap: 5, width: 68 },
  handle: { color: c.textDim, fontSize: f.xs },
});
