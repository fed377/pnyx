import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { CommentsSheet } from "@/components/Comments";
import { Icon } from "@/components/Icon";
import { Media } from "@/components/Media";
import { useToast } from "@/components/Toast";
import { VoteControls } from "@/components/VoteControls";
import { VoteResult } from "@/components/VoteResult";
import { COLD_START } from "@/lib/algorithm";

import { rankReels } from "@/lib/feed";
import { nearestPoint } from "@/lib/grids";
import type { Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { c, f, r, s } from "@/theme/tokens";

function Reel({
  content,
  index,
  height,
  playing,
}: {
  content: Content;
  index: number;
  height: number;
  playing: boolean;
}) {
  const { vote, reactionOf, isFollowing, people } = useStore();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState(false);

  // useAuthor resolves you, a known person, or an unloaded profile.
  const author = useAuthor(content.authorId);
  const own = author.isMe;
  const myVote = reactionOf(content.id);
  const friends = people.filter((p) => isFollowing(p.id));
  const type = nearestPoint("values", author.positions.values);

  const share = async () => {
    try {
      await Share.share({ message: `"${content.text}" — @${author.handle} on PNYX` });
    } catch {
      toast("Couldn't share that one");
    }
  };

  return (
    <View style={{ height }} accessibilityLabel={`Reel by ${author.name}`}>
      <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} fill playing={playing} />

      <View style={[styles.top, { top: insets.top + s[3] }]}>
        <Pressable
          style={styles.authorChip}
          accessibilityRole="link"
          accessibilityLabel={`Open ${author.name}'s profile`}
          onPress={() => router.push({ pathname: "/u/[id]", params: { id: author.id } })}
        >
          <Avatar name={author.name} positions={author.positions} size={38} />
          <View>
            <Text style={styles.authorName}>{author.name}</Text>
            <Text style={styles.authorMeta}>
              @{author.handle} · {type.name}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Rail and caption share one column so the rail can never sit under it. */}
      <View style={styles.stack} pointerEvents="box-none">
        <View style={styles.rail} pointerEvents="box-none">
          <VoteControls
            layout="rail"
            size={52}
            overlay
            current={myVote}
            disabled={own}
            onDisabledPress={() => toast("You can't vote on your own post")}
            onVote={(power) => void vote(content.id, power)}
          />
          <Pressable
            onPress={() => setComments(true)}
            style={styles.railBtn}
            accessibilityRole="button"
            accessibilityLabel={`${content.comments.length} comments`}
          >
            <Icon name="comment" size={22} color="#fff" />
            <Text style={styles.railLabel}>{content.comments.length}</Text>
          </Pressable>
          <Pressable
            onPress={share}
            style={styles.railBtn}
            accessibilityRole="button"
            accessibilityLabel="Share this reel"
          >
            <Icon name="share" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.take}>{content.text}</Text>
          {content.context && <Text style={styles.meta}>{content.context}</Text>}
          {content.music && (
            <View style={styles.music}>
              <Icon name="feed" size={13} color="rgba(236,237,243,0.66)" />
              <Text style={styles.meta}>{content.music}</Text>
            </View>
          )}
          {own ? (
            <Text style={styles.hint}>Your own reel — other people decide where it sits.</Text>
          ) : myVote !== undefined ? (
            <VoteResult content={content} friends={friends} myVote={myVote} onDark />
          ) : (
            index === 0 && <Text style={styles.hint}>Tap to like or dislike · hold for 1.5s to love or hate</Text>
          )}
        </View>
      </View>

      <CommentsSheet content={content} open={comments} onClose={() => setComments(false)} />
    </View>
  );
}

export default function FeedScreen() {
  const { positions, voteCount, reels: source, refresh, loading, mode, accent } = useStore();
  const insets = useSafeAreaInsets();
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
  const reels = useMemo(() => rankReels(source, positionsRef.current, voteCountRef.current), [source]);

  return (
    <View style={styles.screen} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Reel content={item} index={index} height={height} playing={index === visible} />
          )}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          windowSize={3}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={
            mode === "remote" ? (
              <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={accent} colors={[accent]} />
            ) : undefined
          }
        />
      )}
      {voteCount < COLD_START && (
        <View style={[styles.chip, { top: insets.top + 58 }]} pointerEvents="none">
          <Text style={styles.chipText}>{`Calibrating · ${voteCount}/${COLD_START}`}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  top: { position: "absolute", left: s[4], zIndex: 2 },
  authorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[3],
    paddingLeft: 6,
    paddingRight: s[3],
    paddingVertical: 6,
    borderRadius: r.full,
    backgroundColor: c.overlay,
  },
  authorName: { color: "#fff", fontSize: f.sm, fontWeight: "600" },
  authorMeta: { color: "rgba(236,237,243,0.7)", fontSize: f.xs },
  stack: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "flex-end" },
  rail: { alignSelf: "flex-end", alignItems: "center", gap: s[4], paddingHorizontal: s[4], paddingBottom: s[3] },
  railBtn: { alignItems: "center", gap: 3 },
  railLabel: { color: "#fff", fontSize: f.xs },
  bottom: {
    maxHeight: "62%",
    padding: s[4],
    gap: s[2],
    backgroundColor: "rgba(8,8,13,0.72)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  take: { color: "#fff", fontSize: 23, fontWeight: "600", lineHeight: 29, letterSpacing: -0.4 },
  meta: { color: "rgba(236,237,243,0.66)", fontSize: f.xs },
  music: { flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { color: "rgba(236,237,243,0.5)", fontSize: f.xs, marginTop: s[1] },
  chip: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: s[3],
    paddingVertical: 5,
    borderRadius: r.full,
    backgroundColor: c.overlay,
    borderWidth: 1,
    borderColor: c.line,
  },
  chipText: { color: c.textDim, fontSize: f.xs },
});
