import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AnimatedPressable, enterDelay } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { BlurBackdrop } from "@/components/BlurBackdrop";
import { TopBar } from "@/components/Chrome";
import { HotTakeViewer } from "@/components/HotTakeViewer";
import { Icon } from "@/components/Icon";
import { PhotoViewer } from "@/components/PhotoViewer";
import { PostCard } from "@/components/PostCard";
import { Btn, Chip, Empty, Progress, SectionTitle } from "@/components/Primitives";
import { UNLOCK_AT } from "@/lib/algorithm";
import { useHotTakes } from "@/state/useHotTakes";
import { useStore } from "@/state/store";
import { c, display, f, r, s, squircle, TAB_BAR_CLEARANCE } from "@/theme/tokens";

/** Even on all four sides, and the one value the button's concentric radius is derived from. */
const UNLOCK_PADDING = s[4];

/** "Friends first" narrows to people you're closely aligned with — a simple on/off
 * stand-in for the full 0-100 slider still available on People. */
const FRIENDS_FIRST_THRESHOLD = 50;

function AlignmentToggle() {
  const { state, dispatch } = useStore();
  const friendsFirst = state.alignmentFilter >= FRIENDS_FIRST_THRESHOLD;

  return (
    <View style={styles.toggleRow}>
      <Chip
        label="Any alignment"
        selected={!friendsFirst}
        onPress={() => dispatch({ type: "filter", value: 0 })}
      />
      <Chip
        label="Friends first"
        selected={friendsFirst}
        onPress={() => dispatch({ type: "filter", value: FRIENDS_FIRST_THRESHOLD })}
      />
    </View>
  );
}

function UnlockBanner() {
  const { voteCount, unlockProgress, unlocked, accentSoft } = useStore();
  const router = useRouter();
  if (unlocked) return null;

  return (
    <View style={[styles.unlock, { backgroundColor: accentSoft }]}>
      {/* The count and the unit are separate Text nodes for layout, so the whole
          phrase is announced as one label rather than two loose fragments. */}
      <View
        style={styles.unlockHead}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${UNLOCK_AT - voteCount} more reactions`}
      >
        <Text style={styles.unlockNum}>{UNLOCK_AT - voteCount}</Text>
        <Text style={styles.unlockUnit}>more reactions</Text>
      </View>
      <Text style={styles.unlockBody}>
        Your type stays hidden until PNYX has enough of your opinions to be sure of it.
      </Text>
      <Progress value={unlockProgress} />
      <Btn
        label="Open the Feed"
        variant="accent"
        icon="chevron"
        onPress={() => router.push("/feed")}
        // Concentric with the card around it: sharing the same corner center
        // means the gap between the two curves stays the padding's width all
        // the way round, instead of the button's default full-pill radius
        // reading as a mismatched shape against a squarer parent.
        style={{ borderRadius: r.lg - UNLOCK_PADDING }}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { alignmentWith, state, accent, posts: source, peopleById, refresh, loading, mode, myId } = useStore();
  const router = useRouter();
  const [takeIndex, setTakeIndex] = useState<number | null>(null);
  const { items: hotTakes, refresh: refreshHotTakes } = useHotTakes();
  const visibleTakes = useMemo(() => hotTakes.filter((t) => peopleById[t.authorId]), [hotTakes, peopleById]);

  // Posting a hot take happens on a separate screen (`/hot-take`) that shares
  // no state with this one's own useHotTakes() instance — refetch whenever
  // Home regains focus so a just-posted take actually shows up back here.
  useFocusEffect(
    useCallback(() => {
      void refreshHotTakes();
    }, [refreshHotTakes]),
  );

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

  const photos = useMemo(() => posts.filter((p) => p.type === "image"), [posts]);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);

  const firstName = state.profile.name.split(" ")[0] || state.profile.handle;

  return (
    <BlurBackdrop style={styles.screen}>
      <TopBar showNotifications />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          mode === "remote" ? (
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={accent} colors={[accent]} />
          ) : undefined
        }
      >
        <View>
          <Text style={styles.greeting}>Hello, {firstName}!</Text>
          <Text style={styles.greetingSub}>Here&apos;s what people really think.</Text>
        </View>

        <AlignmentToggle />

        <UnlockBanner />

        <View>
          <SectionTitle>Hot takes</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.takesRow}>
            <AnimatedPressable
              onPress={() => router.push("/hot-take")}
              scaleTo={0.92}
              style={styles.take}
              accessibilityRole="button"
              accessibilityLabel="Post a hot take"
            >
              <View style={[styles.takeRing, styles.takeAdd]}>
                <Icon name="plus" size={22} color={c.textDim} />
              </View>
              <Text style={styles.takeName} numberOfLines={1}>
                New
              </Text>
            </AnimatedPressable>
            {visibleTakes.map((t, i) => {
              const p = peopleById[t.authorId];
              return (
                <AnimatedPressable
                  key={t.id}
                  onPress={() => setTakeIndex(i)}
                  scaleTo={0.92}
                  style={styles.take}
                  accessibilityRole="button"
                  accessibilityLabel={`Hot take from ${p.name}`}
                >
                  <View style={styles.takeRing}>
                    <Avatar name={p.name} positions={p.positions} size={54} badge={false} photoUrl={p.avatarUrl} />
                  </View>
                  <Text style={styles.takeName} numberOfLines={1}>
                    {p.handle}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>

        {posts.length === 0 ? (
          <Empty>
            Nobody clears {state.alignmentFilter}% alignment yet. Lower the filter, or vote on more reels to sharpen
            your position.
          </Empty>
        ) : (
          <View style={{ gap: s[5] }}>
            {posts.map((post, i) => (
              <Animated.View key={post.id} entering={FadeInDown.duration(260).delay(enterDelay(i))}>
                <PostCard
                  content={post}
                  onOpenPhoto={
                    post.type === "image"
                      ? (id) => setPhotoIndex(photos.findIndex((p) => p.id === id))
                      : undefined
                  }
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {takeIndex !== null && (
        <HotTakeViewer
          takes={visibleTakes}
          index={takeIndex}
          onIndexChange={setTakeIndex}
          peopleById={peopleById}
          onClose={() => setTakeIndex(null)}
        />
      )}

      {photoIndex !== null && (
        <PhotoViewer items={photos} index={photoIndex} onIndexChange={setPhotoIndex} onClose={() => setPhotoIndex(null)} />
      )}
    </BlurBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: TAB_BAR_CLEARANCE, gap: s[5] },
  greeting: { color: c.text, fontSize: 30, fontFamily: display.bold, letterSpacing: -0.5 },
  greetingSub: { color: c.textDim, fontSize: f.md, marginTop: 2 },
  toggleRow: { flexDirection: "row", gap: s[2] },
  unlock: {
    padding: UNLOCK_PADDING,
    borderRadius: r.lg,
    gap: s[3],
    ...squircle,
  },
  unlockHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  unlockNum: { color: c.text, fontSize: 44, fontFamily: display.bold, letterSpacing: -1.2 },
  unlockUnit: { color: c.textDim, fontSize: f.md, fontWeight: "500" },
  unlockBody: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  takesRow: { gap: s[4], paddingRight: s[4] },
  take: { alignItems: "center", gap: 6, width: 64 },
  takeRing: {
    width: 64,
    height: 64,
    borderRadius: r.full,
    borderWidth: 1.5,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  takeAdd: { borderStyle: "dashed", backgroundColor: c.surface2 },
  takeName: { color: c.textDim, fontSize: f.xs },
});
