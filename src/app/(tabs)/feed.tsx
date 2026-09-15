import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { BlurBackdrop } from "@/components/BlurBackdrop";
import { TopBar } from "@/components/Chrome";
import { CommentsSheet } from "@/components/Comments";
import { Icon } from "@/components/Icon";
import { Media, isVideoUrl } from "@/components/Media";
import { Card } from "@/components/Primitives";
import { useToast } from "@/components/Toast";
import { VoteControls } from "@/components/VoteControls";
import { VoteResult } from "@/components/VoteResult";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

import { compactCount, timeAgoLong } from "@/lib/format";
import { rankReels } from "@/lib/feed";
import { GRID_LIST, nearestPoint } from "@/lib/grids";
import type { Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { c, display, f, r, s, squircle, TAB_BAR_CLEARANCE } from "@/theme/tokens";

/** The grid this post's scores are most confident on — shown as the card's category chip. */
function primaryGrid(content: Content) {
  return GRID_LIST.reduce((best, g) =>
    content.scores[g.id].confidence > content.scores[best.id].confidence ? g : best,
  );
}

function Reel({
  content,
  height,
  playing,
}: {
  content: Content;
  height: number;
  playing: boolean;
}) {
  const { vote, reactionOf, pendingUntilOf, isVoteLocked, isFollowing, people, peopleById, alignmentWith } =
    useStore();
  const router = useRouter();
  const toast = useToast();
  const [comments, setComments] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
    <View style={{ height }} accessibilityLabel={`Reel by ${author.name}`}>
      <Media
        id={content.id}
        scores={content.scores}
        mediaUrl={content.mediaUrl}
        fill
        playing={playing}
      />

      <View style={styles.stack} pointerEvents="box-none">
        <Card tone="ink" style={styles.card}>
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={
              expanded
                ? "Hide the vote split and extra detail"
                : "Show the vote split and extra detail"
            }
          >
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{grid.label}</Text>
              </View>
              {isVideoUrl(content.mediaUrl) && (
                <View style={styles.chip}>
                  <Icon name="play" size={11} color="#fff" filled />
                </View>
              )}
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
                    <Icon name="feed" size={13} color="rgba(255,255,255,0.7)" />
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
              onDisabledPress={() => toast("You can't vote on your own post")}
              onVote={(power) => vote(content.id, power)}
            />
            <AnimatedPressable
              onPress={() => setComments(true)}
              scaleTo={0.9}
              style={styles.ghostPill}
              accessibilityRole="button"
              accessibilityLabel={`${content.comments.length} comments`}
            >
              <Icon name="comment" size={18} color="#fff" />
              <Text style={styles.pillCount}>{compactCount(content.comments.length)}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={share}
              scaleTo={0.9}
              style={styles.ghostPill}
              accessibilityRole="button"
              accessibilityLabel="Share this reel"
            >
              <Icon name="share" size={18} color="#fff" />
            </AnimatedPressable>
          </View>

          <Text style={styles.timestamp}>{timeAgoLong(content.createdAt)}</Text>
        </Card>
      </View>

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
    loading,
    mode,
    accent,
  } = useStore();
  const [height, setHeight] = useState(0);
  const [visible, setVisible] = useState(0);

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
    () => rankReels(source, positionsRef.current, voteCountRef.current),
    [source],
  );

  return (
    <BlurBackdrop
      style={styles.screen}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {height > 0 && (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Reel content={item} height={height} playing={index === visible} />
          )}
          pagingEnabled
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
                refreshing={loading}
                onRefresh={() => void refresh()}
                tintColor={accent}
                colors={[accent]}
              />
            ) : undefined
          }
        />
      )}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <TopBar showWordmark={false} tint="dark" />
      </View>
    </BlurBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  topOverlay: { position: "absolute", left: 0, right: 0, top: 0 },
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
  card: { borderRadius: r.lg, gap: s[3] },
  chipRow: { flexDirection: "row", gap: s[2] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s[3],
    height: 26,
    borderRadius: r.full,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    ...squircle,
  },
  chipText: { color: "#fff", fontSize: f.xs, fontWeight: "600" },
  byline: { flexDirection: "row", alignItems: "center", gap: s[2] },
  name: { color: c.app, fontSize: f.sm, fontFamily: display.semibold },
  sub: { color: "rgba(255,255,255,0.6)", fontSize: f.xs, marginTop: 1 },
  take: { color: c.app, fontSize: f.md, fontFamily: display.semibold, lineHeight: 22 },
  detail: { gap: s[2] },
  context: { color: "rgba(255,255,255,0.7)", fontSize: f.xs },
  music: { flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { color: "rgba(255,255,255,0.6)", fontSize: f.xs },
  actions: { flexDirection: "row", alignItems: "center", gap: s[2] },
  ghostPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: s[3],
    borderRadius: r.full,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    ...squircle,
  },
  pillCount: { color: "#fff", fontSize: f.sm, fontWeight: "600" },
  timestamp: { color: "rgba(255,255,255,0.5)", fontSize: f.xs },
});
