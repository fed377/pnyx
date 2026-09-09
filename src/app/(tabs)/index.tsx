import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlignmentFilter } from "@/components/AlignmentFilter";
import { Avatar } from "@/components/Avatar";
import { TopBar } from "@/components/Chrome";
import { PostCard } from "@/components/PostCard";
import { Btn, Empty, SectionTitle } from "@/components/Primitives";
import { Sheet } from "@/components/Sheet";
import { UNLOCK_AT } from "@/lib/algorithm";
import { HOT_TAKES } from "@/lib/data";
import type { HotTake } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, r, s } from "@/theme/tokens";

function UnlockBanner() {
  const { voteCount, unlockProgress, unlocked, accent, accentLine } = useStore();
  const router = useRouter();
  if (unlocked) return null;

  return (
    <View style={[styles.unlock, { borderColor: accentLine }]}>
      <Text style={styles.unlockTitle}>{`${UNLOCK_AT - voteCount} more reactions`}</Text>
      <Text style={styles.unlockBody}>
        Your type stays hidden until PNYX has enough of your opinions to be sure of it.
      </Text>
      <View
        style={styles.meter}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: UNLOCK_AT, now: voteCount }}
      >
        <View style={{ width: `${unlockProgress * 100}%`, height: "100%", backgroundColor: accent }} />
      </View>
      <Btn label="Open the Feed" variant="accent" icon="chevron" onPress={() => router.push("/feed")} />
    </View>
  );
}

export default function HomeScreen() {
  const { alignmentWith, state, accent, posts: source, peopleById, refresh, loading, mode, myId } = useStore();
  const [take, setTake] = useState<HotTake | null>(null);

  const posts = useMemo(() => {
    const min = state.alignmentFilter;
    return source
      .filter((post) => {
        if (post.authorId === myId) return true;
        const author = peopleById[post.authorId];
        return author ? alignmentWith(author) >= min : true;
      })
      .sort((a, b) => {
        // Followers and following come first (spec section 6.1), then recency.
        const rank = (id: string) => (id === myId || state.follows[id] ? 0 : 1);
        const d = rank(a.authorId) - rank(b.authorId);
        return d !== 0 ? d : b.createdAt - a.createdAt;
      });
  }, [state.alignmentFilter, state.follows, alignmentWith, source, peopleById, myId]);

  const takePerson = take ? (peopleById[take.authorId] ?? null) : null;

  return (
    <View style={styles.screen}>
      <TopBar showBell />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          mode === "remote" ? (
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={accent} colors={[accent]} />
          ) : undefined
        }
      >
        <UnlockBanner />

        <View>
          <SectionTitle>Hot Takes</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.takesRow}>
            {HOT_TAKES.filter((t) => peopleById[t.authorId]).map((t) => {
              const p = peopleById[t.authorId];
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTake(t)}
                  style={styles.take}
                  accessibilityRole="button"
                  accessibilityLabel={`Hot take from ${p.name}`}
                >
                  <View style={[styles.takeRing, { borderColor: accent }]}>
                    <Avatar name={p.name} positions={p.positions} size={54} badge={false} />
                  </View>
                  <Text style={styles.takeName} numberOfLines={1}>
                    {p.handle}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <AlignmentFilter />

        {posts.length === 0 ? (
          <Empty>
            Nobody clears {state.alignmentFilter}% alignment yet. Lower the filter, or vote on more reels to sharpen
            your position.
          </Empty>
        ) : (
          <View style={{ gap: s[5] }}>
            {posts.map((post) => (
              <PostCard key={post.id} content={post} />
            ))}
          </View>
        )}
      </ScrollView>

      <Sheet open={Boolean(take)} title="Hot Take" onClose={() => setTake(null)}>
        {take && takePerson && (
          <View style={{ gap: s[4] }}>
            <View style={styles.takeWho}>
              <Avatar name={takePerson.name} positions={takePerson.positions} size={40} />
              <View>
                <Text style={styles.takeWhoName}>{takePerson.name}</Text>
                <Text style={styles.takeWhoMeta}>@{takePerson.handle} · expires in 14h</Text>
              </View>
            </View>
            <Text style={styles.takeText}>{take.text}</Text>
            <Text style={styles.takeNote}>Hot Takes disappear after a day and don&apos;t move your grids.</Text>
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7], gap: s[5] },
  unlock: {
    padding: s[4],
    paddingVertical: s[5],
    borderWidth: 1,
    borderRadius: r.lg,
    backgroundColor: c.surface,
    gap: s[3],
  },
  unlockTitle: { color: c.text, fontSize: f.xl, fontWeight: "600", letterSpacing: -0.4 },
  unlockBody: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  meter: { height: 4, borderRadius: r.full, backgroundColor: c.surface3, overflow: "hidden" },
  takesRow: { gap: s[4], paddingRight: s[4] },
  take: { alignItems: "center", gap: 6, width: 64 },
  takeRing: {
    width: 64,
    height: 64,
    borderRadius: r.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  takeName: { color: c.textDim, fontSize: f.xs },
  takeWho: { flexDirection: "row", alignItems: "center", gap: s[3] },
  takeWhoName: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  takeWhoMeta: { color: c.textFaint, fontSize: f.xs },
  takeText: { color: c.text, fontSize: f.xl, fontWeight: "600", lineHeight: 30, letterSpacing: -0.4 },
  takeNote: { color: c.textDim, fontSize: f.sm },
});
