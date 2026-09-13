import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { BlurBackdrop } from "@/components/BlurBackdrop";
import { CommentsSheet } from "@/components/Comments";
import { Icon } from "@/components/Icon";
import { Media } from "@/components/Media";
import { useToast } from "@/components/Toast";
import {
  RAIL_GAP,
  RAIL_LABEL_GAP,
  VoteControls,
} from "@/components/VoteControls";
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

import { rankReels } from "@/lib/feed";
import { nearestPoint } from "@/lib/grids";
import type { Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { c, f, s, TAB_BAR_CLEARANCE } from "@/theme/tokens";

/**
 * Rail glyphs are laid out edge to edge — no padded boxes — so the gap in the
 * stylesheet is the gap you see, and every item on the rail sits the same
 * distance from its neighbour. Touch targets come from hitSlop instead.
 */
const RAIL_SIZE = 52;
const RAIL_ICON = 26;
const RAIL_SLOP = { top: 10, bottom: 10, left: 12, right: 12 };

function Reel({
  content,
  height,
  playing,
}: {
  content: Content;
  height: number;
  playing: boolean;
}) {
  const { vote, reactionOf, pendingUntilOf, isVoteLocked, isFollowing, people } =
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

      {/*
       * Caption and rail sit side by side, both anchored to the bottom, so the
       * rail starts level with the caption instead of climbing the screen.
       * Neither has a panel behind it: the text carries its own shadow, and the
       * detail grows upward over the video when the caption is opened.
       */}
      <View style={styles.stack} pointerEvents="box-none">
        <View style={styles.bottomRow} pointerEvents="box-none">
          <Pressable
            style={styles.caption}
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={
              expanded
                ? "Hide the full caption and the vote split"
                : "Show the full caption and how everyone voted"
            }
          >
            {expanded && (
              <Animated.View
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}
                layout={Layout.duration(220)}
                style={styles.detail}
              >
                {own ? (
                  <Text style={styles.hint}>
                    Your own reel — other people decide where it sits.
                  </Text>
                ) : (
                  myVote !== undefined && (
                    <VoteResult
                      content={content}
                      friends={friends}
                      myVote={myVote}
                      onDark
                    />
                  )
                )}
                {content.context && (
                  <Text style={styles.context}>{content.context}</Text>
                )}
                {content.music && (
                  <View style={styles.music}>
                    <Icon name="feed" size={13} color="rgba(236,237,243,0.7)" />
                    <Text style={styles.context}>{content.music}</Text>
                  </View>
                )}
                <Text style={styles.context}>
                  {author.name} · {author.locked ? "Unrevealed" : type.name}
                </Text>
              </Animated.View>
            )}

            <AnimatedPressable
              scaleTo={0.97}
              style={styles.byline}
              accessibilityRole="link"
              accessibilityLabel={`Open ${author.name}'s profile`}
              onPress={() =>
                router.push({ pathname: "/u/[id]", params: { id: author.id } })
              }
            >
              <Avatar
                name={author.name}
                positions={author.positions}
                size={28}
              />
              <Text style={styles.handle}>@{author.handle}</Text>
            </AnimatedPressable>

            <Text style={styles.take} numberOfLines={expanded ? undefined : 2}>
              {content.text}
            </Text>
          </Pressable>

          <View style={styles.rail} pointerEvents="box-none">
            <VoteControls
              layout="rail"
              size={RAIL_SIZE}
              overlay
              current={myVote}
              pendingUntil={pendingUntilOf(content.id)}
              locked={isVoteLocked(content.id)}
              onLockedPress={() =>
                toast("Your vote is counted — it can't be changed")
              }
              disabled={own}
              onDisabledPress={() => toast("You can't vote on your own post")}
              onVote={(power) => vote(content.id, power)}
            />
            <AnimatedPressable
              onPress={() => setComments(true)}
              hitSlop={RAIL_SLOP}
              scaleTo={0.85}
              style={styles.railBtn}
              accessibilityRole="button"
              accessibilityLabel={`${content.comments.length} comments`}
            >
              <Icon name="comment" size={RAIL_ICON} color={c.text} />
              <Text style={styles.railLabel}>{content.comments.length}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={share}
              hitSlop={RAIL_SLOP}
              scaleTo={0.85}
              style={styles.railBtn}
              accessibilityRole="button"
              accessibilityLabel="Share this reel"
            >
              <Icon name="share" size={RAIL_ICON} color={c.text} />
            </AnimatedPressable>
          </View>
        </View>
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
    </BlurBackdrop>
  );
}

/** Keeps caption text legible over video without putting a panel behind it. */
const shadow = {
  textShadowColor: "rgba(0,0,0,0.75)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  stack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: s[4],
    paddingBottom: s[4],
    gap: s[3],
  },
  caption: { flex: 1, gap: s[2] },
  detail: { gap: s[2], marginBottom: s[1] },
  byline: { flexDirection: "row", alignItems: "center", gap: s[2] },
  handle: { color: c.text, fontSize: f.sm, fontWeight: "600", ...shadow },
  take: {
    color: c.text,
    fontSize: f.md,
    fontWeight: "500",
    lineHeight: 21,
    ...shadow,
  },
  context: { color: "rgba(236,237,243,0.78)", fontSize: f.xs, ...shadow },
  music: { flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { color: "rgba(236,237,243,0.6)", fontSize: f.xs, ...shadow },
  rail: { alignItems: "center", gap: RAIL_GAP },
  railBtn: { alignItems: "center", gap: RAIL_LABEL_GAP },
  railLabel: { color: c.text, fontSize: f.xs, ...shadow },
});
