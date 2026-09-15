import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { PageHeader } from "@/components/Chrome";
import { Btn } from "@/components/Primitives";
import { ProfileView } from "@/components/ProfileView";
import { affinity } from "@/lib/feed";
import { GRID_IDS } from "@/lib/grids";
import type { GridId, PrivacyTier } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, s } from "@/theme/tokens";

/** What each privacy tier reveals (spec section 6.5). */
function hiddenGridsFor(tier: PrivacyTier): GridId[] {
  if (tier === "private") return [...GRID_IDS];
  if (tier === "active") return ["culture", "focus"];
  return [];
}

export default function PersonProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alignmentWith, isFollowing, toggleFollow, peopleById, reels, posts } = useStore();
  const router = useRouter();
  const person = id ? peopleById[id] : undefined;

  const archive = useMemo(() => {
    if (!person) return { loved: [], hated: [], posts: [] };
    const all = [...reels, ...posts];
    const scored = all
      .map((item) => ({ item, a: affinity(person.positions, item.scores) }))
      .sort((x, y) => y.a - x.a);
    return {
      loved: scored.slice(0, 4).map((x) => x.item),
      hated: scored.slice(-3).reverse().map((x) => x.item),
      posts: all.filter((item) => item.authorId === person.id),
    };
  }, [person, reels, posts]);

  if (!person) return <Redirect href="/people" />;

  const following = isFollowing(person.id);
  const alignment = alignmentWith(person);

  return (
    <View style={styles.screen}>
      <PageHeader title={person.handle} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileView
          name={person.name}
          handle={person.handle}
          pronouns={person.pronouns}
          photoUrl={person.avatarUrl}
          bio={person.bio}
          positions={person.positions}
          alignment={alignment}
          alignmentCaption="aligned"
          hiddenGrids={hiddenGridsFor(person.tier)}
          stats={{ posts: archive.posts.length }}
          mostAligned={{ label: person.name.split(" ")[0] || person.handle, name: "you", pct: alignment }}
          loved={archive.loved}
          hated={archive.hated}
          posts={archive.posts}
          actions={
            <>
              <Btn
                label={following ? "Following" : "Follow"}
                variant={following ? "ink" : "outline"}
                onPress={() => void toggleFollow(person.id)}
              />
              <Btn
                label="Message"
                icon="message"
                onPress={() => router.push({ pathname: "/messages/[id]", params: { id: person.id } })}
              />
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
});
