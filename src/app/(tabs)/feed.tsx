import { track } from "@/analytics/analytics";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { BlurBackdrop } from "@/components/BlurBackdrop";
import { TopBar } from "@/components/Chrome";
import { CommentsSheet } from "@/components/Comments";
import { Icon } from "@/components/Icon";
import { Media, isVideoUrl } from "@/components/Media";
import { Card, OverlayPill } from "@/components/Primitives";
import { useToast } from "@/components/Toast";
import { VoteControls } from "@/components/VoteControls";
import { VoteResult } from "@/components/VoteResult";
import { useZoom } from "@/components/zoom";
import { useIsFocused, useRouter, useScrollToTop } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  Layout,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { compactCount, timeAgoLong } from "@/lib/format";
import { rankReels } from "@/lib/feed";
import { GRID_LIST, nearestPoint } from "@/lib/grids";
import type { Content } from "@/lib/types";
import { useImmersive } from "@/state/immersive";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { c, display, f, hexToRgba, r, s, TAB_BAR_CLEARANCE } from "@/theme/tokens";

/** The grid this post's scores are most confident on — shown as the card's category chip. */
function primaryGrid(content: Content) {
  return GRID_LIST.reduce((best, g) =>
    content.scores[g.id].confidence > content.scores[best.id].confidence ? g : best,
  );
}

const INFO_MS = 280;

function Reel({
  content,
  height,
  playing,
  muted,
  onToggleMute,
  infoHidden,
  onToggleInfo,
  onZoomingChange,
  reelIndex,
  isAgainstGrain,
}: {
  content: Content;
  height: number;
  playing: boolean;
  muted: boolean;
  onToggleMute: () => void;
  /** Feed-wide "clear view": the info card slides away so the whole reel shows. */
  infoHidden: boolean;
  onToggleInfo: () => void;
  /** Lets the list stop scrolling while two fingers are pinching. */
  onZoomingChange: (zooming: boolean) => void;
  reelIndex: number;
  isAgainstGrain: boolean;
}) {
  const { vote, reactionOf, pendingUntilOf, isVoteLocked, isFollowing, people, peopleById, alignmentWith } =
    useStore();
  const router = useRouter();
  const toast = useToast();
  const [comments, setComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isVideo = isVideoUrl(content.mediaUrl);

  // Tap to pause. A reel you scroll away from and come back to starts playing
  // again rather than remembering it was paused.
  const [paused, setPaused] = useState(false);
  const [wasPlaying, setWasPlaying] = useState(playing);
  if (playing !== wasPlaying) {
    setWasPlaying(playing);
    if (!playing) setPaused(false);
  }
  const togglePause = () => setPaused((p) => !p);

  const zoom = useZoom(Dimensions.get("window").width, height, onZoomingChange);
  const tap = Gesture.Tap()
    .enabled(isVideo)
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(togglePause)();
    });
  const mediaGesture = Gesture.Race(zoom.pinch, tap);

  // Clear view: slide the card down past its own height and fade it, while
  // the small "show info" pill fades in where it was.
  const cardHeight = useSharedValue(0);
  const hidden = useSharedValue(infoHidden ? 1 : 0);
  useEffect(() => {
    hidden.value = withTiming(infoHidden ? 1 : 0, { duration: INFO_MS, easing: Easing.out(Easing.cubic) });
  }, [infoHidden, hidden]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(hidden.value, [0, 0.6], [1, 0], "clamp"),
    transform: [{ translateY: hidden.value * (cardHeight.value + TAB_BAR_CLEARANCE) }],
  }));
  const restoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(hidden.value, [0.4, 1], [0, 1], "clamp"),
    transform: [{ scale: interpolate(hidden.value, [0, 1], [0.9, 1]) }],
  }));

  // Tracks how long this reel was the one on screen, and whether it was
  // voted on or scrolled past — see the "playing" transition effect below.
  const viewedAt = useRef<number | null>(null);
  const votedThisView = useRef(false);

  useEffect(() => {
    if (playing) {
      viewedAt.current = Date.now();
      votedThisView.current = reactionOf(content.id) !== undefined;
      return;
    }
    if (viewedAt.current === null) return;
    const watch_duration = Date.now() - viewedAt.current;
    track("reel_viewed", { reel_index: reelIndex, watch_duration, is_against_grain: isAgainstGrain });
    if (!votedThisView.current && reactionOf(content.id) === undefined) {
      track("reel_skipped", { reel_index: reelIndex, watch_duration });
    }
    viewedAt.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // useAuthor resolves you, a known person, or an unloaded profile.
  const author = useAuthor(content.authorId);
  const own = author.isMe;
  const myVote = reactionOf(content.id);
  const friends = people.filter((p) => isFollowing(p.id));
  const type = nearestPoint("values", author.positions.values);
  const grid = useMemo(() => primaryGrid(content), [content]);
  const person = own ? null : peopleById[content.authorId];
  const alignment = person ? Math.round(alignmentWith(person)) : null;

  const share = async () => {
    try {
      await Share.share({
        message: `"${content.text}" — @${author.handle} on PNYX`,
      });
    } catch {
      toast("Couldn't share that one");
    }
  };

  return (
    <View style={[styles.reel, { height }]} accessibilityLabel={`Reel by ${author.name}`}>
      <GestureDetector gesture={mediaGesture}>
        <Animated.View
          style={[StyleSheet.absoluteFill, zoom.style]}
          accessible={isVideo}
          accessibilityRole={isVideo ? "button" : undefined}
          accessibilityLabel={isVideo ? (paused ? "Play video" : "Pause video") : undefined}
          onAccessibilityTap={isVideo ? togglePause : undefined}
        >
          <Media
            id={content.id}
            scores={content.scores}
            mediaUrl={content.mediaUrl}
            fill
            playing={playing && !paused}
            muted={muted}
          />
        </Animated.View>
      </GestureDetector>

      {/* Everything drawn over the reel fades out as a pinch grows it, so a
          zoom shows only the reel itself. */}
      <Animated.View style={[StyleSheet.absoluteFill, zoom.chromeStyle]} pointerEvents="box-none">
      {paused && (
        <Animated.View
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(140)}
          style={styles.pausedBadge}
          pointerEvents="none"
        >
          <View style={styles.pausedCircle}>
            <Icon name="play" size={30} color={c.onAccent} filled />
          </View>
        </Animated.View>
      )}

      <View style={styles.stack} pointerEvents="box-none">
        <Animated.View
          style={cardStyle}
          pointerEvents={infoHidden ? "none" : "auto"}
          onLayout={(e) => {
            cardHeight.value = e.nativeEvent.layout.height;
          }}
        >
          <Card tone="ink" style={styles.card}>
            <Pressable
              onPress={() => setExpanded((e) => !e)}
              style={styles.info}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={
                expanded
                  ? "Hide the vote split and extra detail"
                  : "Show the vote split and extra detail"
              }
            >
              <View style={styles.chipRow}>
                <OverlayPill height={26}>
                  <Text style={styles.chipText}>{grid.label}</Text>
                </OverlayPill>
                {isVideo && (
                  <OverlayPill
                    height={26}
                    onPress={onToggleMute}
                    accessibilityLabel={muted ? "Turn sound on" : "Mute"}
                  >
                    <Icon name={muted ? "volumeOff" : "volume"} size={14} color={c.onAccent} />
                  </OverlayPill>
                )}
                <OverlayPill
                  height={26}
                  onPress={onToggleInfo}
                  style={styles.minimize}
                  accessibilityLabel="Hide reel info"
                >
                  <View style={styles.chevronDown}>
                    <Icon name="chevron" size={14} color={c.onAccent} strokeWidth={2} />
                  </View>
                </OverlayPill>
              </View>

              <AnimatedPressable
                scaleTo={0.97}
                style={styles.byline}
                accessibilityRole="link"
                accessibilityLabel={`Open ${author.name}'s profile`}
                onPress={() =>
                  router.push(own ? "/profile" : { pathname: "/u/[id]", params: { id: author.id } })
                }
              >
                <Avatar
                  name={author.name}
                  positions={author.positions}
                  size={30}
                  locked={author.locked}
                  badge={false}
                  photoUrl={author.avatarUrl}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {own ? "You" : author.name}
                  </Text>
                  <Text style={styles.handle} numberOfLines={1}>
                    @{author.handle}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {author.locked ? "Unrevealed" : type.name}
                    {alignment !== null && ` · ${alignment}% aligned`}
                  </Text>
                </View>
              </AnimatedPressable>

              <Text style={styles.take} numberOfLines={expanded ? undefined : 3}>
                {content.text}
              </Text>

              {expanded && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(140)}
                  layout={Layout.duration(220)}
                  style={styles.detail}
                >
                  {own ? (
                    <Text style={styles.hint}>Your own reel — other people decide where it sits.</Text>
                  ) : (
                    myVote !== undefined && (
                      <VoteResult content={content} friends={friends} myVote={myVote} onDark />
                    )
                  )}
                  {content.context && <Text style={styles.context}>{content.context}</Text>}
                  {content.music && (
                    <View style={styles.music}>
                      <Icon name="feed" size={13} color={hexToRgba(c.onAccent, 0.7)} />
                      <Text style={styles.context}>{content.music}</Text>
                    </View>
                  )}
                </Animated.View>
              )}
            </Pressable>

            <View style={styles.actions}>
              <VoteControls
                layout="pill"
                size={38}
                counts={{ up: content.globalSplit.love + content.globalSplit.like, down: content.globalSplit.hate + content.globalSplit.dislike }}
                current={myVote}
                pendingUntil={pendingUntilOf(content.id)}
                locked={isVoteLocked(content.id)}
                onLockedPress={() => toast("Your vote is counted — it can't be changed")}
                disabled={own}
                onVote={(power) => {
                  votedThisView.current = true;
                  vote(content.id, power, { reelIndex, viewedAt: viewedAt.current ?? undefined });
                }}
              />
              <OverlayPill
                onPress={() => setComments(true)}
                gap={6}
                accessibilityLabel={`${content.commentCount} comments`}
              >
                <Icon name="comment" size={18} color={c.onAccent} />
                <Text style={styles.pillCount}>{compactCount(content.commentCount)}</Text>
              </OverlayPill>
              <OverlayPill onPress={share} gap={6} accessibilityLabel="Share this reel">
                <Icon name="share" size={18} color={c.onAccent} />
              </OverlayPill>
            </View>

            <Text style={styles.timestamp}>{timeAgoLong(content.createdAt)}</Text>
          </Card>
        </Animated.View>
      </View>

      <Animated.View style={[styles.restore, restoreStyle]} pointerEvents={infoHidden ? "box-none" : "none"}>
        {isVideo && (
          <OverlayPill
            height={44}
            onPress={onToggleMute}
            style={styles.restorePill}
            accessibilityLabel={muted ? "Turn sound on" : "Mute"}
          >
            <Icon name={muted ? "volumeOff" : "volume"} size={20} color={c.onAccent} />
          </OverlayPill>
        )}
        <OverlayPill
          height={44}
          onPress={onToggleInfo}
          gap={6}
          style={styles.restorePill}
          accessibilityLabel="Show reel info"
        >
          <View style={styles.chevronUp}>
            <Icon name="chevron" size={18} color={c.onAccent} strokeWidth={2.2} />
          </View>
          <Text style={styles.restoreLabel}>Info</Text>
        </OverlayPill>
      </Animated.View>
      </Animated.View>

      <CommentsSheet
        content={content}
        open={comments}
        onClose={() => setComments(false)}
      />
    </View>
  );
}

export default function FeedScreen() {
  const {
    positions,
    voteCount,
    reels: source,
    refresh,
    mode,
    accent,
  } = useStore();
  // Seeded from the window so the first reel paints immediately — onLayout
  // still refines it for split-screen/foldable cases, but nothing should
  // wait on a measurement pass to show its first frame (and test renderers
  // never fire onLayout at all, which left this screen permanently blank).
  const [height, setHeight] = useState(() => Dimensions.get("window").height);
  const [visible, setVisible] = useState(0);
  // Reels play with sound; one toggle mutes the whole feed, like other reel apps.
  const [muted, setMuted] = useState(false);
  // Like mute, "clear view" carries on to the next reel until turned back off.
  const [infoHidden, setInfoHidden] = useState(false);
  const [zooming, setZooming] = useState(false);
  // Tabs stay mounted, so without this the current reel would keep playing —
  // now audibly — behind every other tab and pushed screen.
  const focused = useIsFocused();

  // Tapping the Feed tab while already on it jumps back to the first reel.
  const listRef = useRef<FlatList<Content>>(null);
  useScrollToTop(listRef);

  // A zoom shows only the reel: the tab layout drops its glass chrome too.
  const { setImmersive } = useImmersive();
  useEffect(() => {
    setImmersive(zooming && focused);
  }, [zooming, focused, setImmersive]);
  useEffect(() => () => setImmersive(false), [setImmersive]);

  // The spinner shows only for a pull the user actually made. It used to
  // mirror the store's `loading`, which also goes true for the silent refresh
  // on launch and on every return to the foreground — and a programmatic
  // RefreshControl on iOS pushes a paged list down by the spinner's height
  // and can leave it stranded there, a sliver off-page, until touched.
  const [pulling, setPulling] = useState(false);
  const onPull = async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
      snapToPage();
    }
  };

  // Belt and braces for the same symptom (and for a height change after a
  // layout pass): settle back onto whole reels from wherever the list is.
  const scrollY = useRef(0);
  const snapToPage = () => {
    if (height <= 0) return;
    const page = Math.max(0, Math.round(scrollY.current / height));
    listRef.current?.scrollToOffset({ offset: page * height, animated: true });
    setVisible(page);
  };
  useEffect(() => {
    snapToPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-snap only when the page height changes
  }, [height]);

  // Only the reel actually on screen plays; the rest stay paused.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const first = viewableItems[0]?.index;
      if (typeof first === "number") setVisible(first);
    },
  ).current;

  // Re-ranked only when the underlying set changes — deliberately not on every
  // vote, so the list never reshuffles underneath the user mid-scroll. Remote
  // content arrives asynchronously, so this cannot be a one-shot useState.
  const positionsRef = useRef(positions);
  const voteCountRef = useRef(voteCount);
  positionsRef.current = positions;
  voteCountRef.current = voteCount;
  const reels = useMemo(
    () => rankReels(source, positionsRef.current, voteCountRef.current, (c) => c.globalSplit),
    [source],
  );

  return (
    <BlurBackdrop
      style={styles.screen}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {height > 0 && (
        <FlatList
          ref={listRef}
          data={reels}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Reel
              content={item}
              height={height}
              playing={focused && index === visible}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              infoHidden={infoHidden}
              onToggleInfo={() => setInfoHidden((h) => !h)}
              onZoomingChange={setZooming}
              reelIndex={index}
              // Mirrors rankReels' own insertion rule (lib/feed.ts) — only an
              // approximation of which slot is the deliberate outlier, since
              // rankReels doesn't tag its own output, but the same condition.
              isAgainstGrain={voteCount >= 50 && index > 0 && index % 20 === 19}
            />
          )}
          pagingEnabled
          // A two-finger pinch would otherwise also drag the list.
          scrollEnabled={!zooming}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: height,
            offset: height * index,
            index,
          })}
          windowSize={3}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={
            mode === "remote" ? (
              <RefreshControl
                refreshing={pulling}
                onRefresh={() => void onPull()}
                tintColor={accent}
                colors={[accent]}
              />
            ) : undefined
          }
        />
      )}
      {/* Hidden outright, not faded, while zooming: it's native glass (see
          state/immersive). */}
      <View style={[styles.topOverlay, zooming && styles.hidden]} pointerEvents="box-none">
        <TopBar showWordmark={false} tint="dark" />
      </View>
    </BlurBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  topOverlay: { position: "absolute", left: 0, right: 0, top: 0 },
  hidden: { display: "none" },
  stack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
    paddingHorizontal: s[4],
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  // Clips a zoomed reel to its own page instead of spilling over its neighbours.
  reel: { overflow: "hidden" },
  pausedBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pausedCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: hexToRgba("#000000", 0.4),
  },
  restore: {
    position: "absolute",
    right: s[4],
    bottom: TAB_BAR_CLEARANCE,
    flexDirection: "row",
    gap: s[2],
  },
  // With the info card gone these are the only controls on screen, over any
  // video — the stock outlined pill disappears against bright footage, so they
  // get a solid dark fill, a stronger rim and a lift off the video.
  restorePill: {
    paddingHorizontal: s[4],
    backgroundColor: "rgba(20,19,17,0.62)",
    borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  restoreLabel: { color: c.onAccent, fontSize: f.sm, fontWeight: "700" },
  card: { borderRadius: r.lg, gap: s[3] },
  info: { gap: s[3] },
  chipRow: { flexDirection: "row", gap: s[2] },
  minimize: { marginLeft: "auto" },
  chevronDown: { transform: [{ rotate: "90deg" }] },
  chevronUp: { transform: [{ rotate: "-90deg" }] },
  chipText: { color: c.onAccent, fontSize: f.xs, fontWeight: "600" },
  byline: { flexDirection: "row", alignItems: "center", gap: s[2] },
  name: { color: c.app, fontSize: f.sm, fontFamily: display.semibold },
  handle: { color: hexToRgba(c.onAccent, 0.75), fontSize: f.xs, marginTop: 1 },
  sub: { color: hexToRgba(c.onAccent, 0.6), fontSize: f.xs, marginTop: 1 },
  take: { color: c.app, fontSize: f.md, fontFamily: display.semibold, lineHeight: 22 },
  detail: { gap: s[2] },
  context: { color: hexToRgba(c.onAccent, 0.7), fontSize: f.xs },
  music: { flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { color: hexToRgba(c.onAccent, 0.6), fontSize: f.xs },
  // On top of the card's own gap, so the vote row doesn't crowd the take and byline.
  actions: { flexDirection: "row", alignItems: "center", gap: s[2], marginTop: s[2] },
  pillCount: { color: c.onAccent, fontSize: f.sm, fontWeight: "600" },
  timestamp: { color: hexToRgba(c.onAccent, 0.5), fontSize: f.xs },
});
