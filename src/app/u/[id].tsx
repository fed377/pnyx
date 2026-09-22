import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { track } from "@/analytics/analytics";
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
  const { alignmentWith, isFollowing, toggleFollow, isBlocked, toggleBlock, peopleById, reels, posts } = useStore();
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

  useEffect(() => {
    if (person) track("profile_viewed");
  }, [person?.id]);

  if (!person) return <Redirect href="/people" />;

  const following = isFollowing(person.id);
  const blocked = isBlocked(person.id);
  const alignment = alignmentWith(person);

  const confirmBlock = () => {
    Alert.alert(
      blocked ? `Unblock ${person.name}?` : `Block ${person.name}?`,
      blocked
        ? "You'll see their posts again, and they'll be able to message you."
        : "You won't see their posts, and they won't be able to message you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: blocked ? "Unblock" : "Block",
          style: blocked ? "default" : "destructive",
          onPress: () => void toggleBlock(person.id),
        },
      ],
    );
  };

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
            blocked ? (
              <Btn label="Unblock" variant="outline" onPress={confirmBlock} />
            ) : (
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
                <Btn label="Block" variant="danger" onPress={confirmBlock} />
              </>
            )
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
