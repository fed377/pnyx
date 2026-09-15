import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { AlignmentPill } from "@/components/Alignment";
import { Avatar } from "@/components/Avatar";
import { BlurBackdrop } from "@/components/BlurBackdrop";
import { TopBar } from "@/components/Chrome";
import { Btn, SectionTitle } from "@/components/Primitives";
import { useToast } from "@/components/Toast";
import { ProfileView } from "@/components/ProfileView";

import type { Person } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, s, TAB_BAR_CLEARANCE } from "@/theme/tokens";

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
            <Avatar name={p.name} positions={p.positions} size={48} photoUrl={p.avatarUrl} />
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
  const toast = useToast();

  const share = async () => {
    try {
      await Share.share({ message: `@${state.profile.handle} on PNYX` });
    } catch {
      toast("Couldn't share your profile");
    }
  };

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

  const closest = useMemo(
    () => [...people].sort((a, b) => alignmentWith(b) - alignmentWith(a))[0],
    [alignmentWith, people],
  );

  const firstName = state.profile.name.split(" ")[0] || state.profile.handle;

  return (
    <BlurBackdrop style={styles.screen}>
      <TopBar wordmark={firstName.toLowerCase()} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProfileView
          name={state.profile.name}
          handle={state.profile.handle}
          pronouns={state.profile.pronouns}
          photoUrl={state.profile.avatarUrl}
          bio={state.profile.bio}
          positions={positions}
          alignment={100}
          alignmentCaption="you"
          locked={!unlocked}
          stats={{
            posts: state.myPosts.length,
            followers: people.filter((p) => p.follower).length,
            following: people.filter((p) => isFollowing(p.id)).length,
          }}
          mostAligned={closest ? { label: "you", name: closest.name, pct: alignmentWith(closest) } : undefined}
          loved={loved}
          hated={hated}
          posts={state.myPosts}
          actions={
            <>
              <Btn label="Edit page" variant="ink" onPress={() => router.push("/settings")} />
              <Btn label="Share" variant="outline" icon="share" onPress={() => void share()} />
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
    </BlurBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: TAB_BAR_CLEARANCE },
  row: { gap: s[4], paddingRight: s[4] },
  item: { alignItems: "center", gap: 5, width: 68 },
  handle: { color: c.textDim, fontSize: f.xs },
});
