import { useRouter } from "expo-router";
import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { GRID_LIST } from "@/lib/grids";
import { timeAgoLong } from "@/lib/format";
import type { Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { c, display, f, hexToRgba, r, s, squircle, TAB_BAR_CLEARANCE } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Avatar } from "./Avatar";
import { CommentsSheet } from "./Comments";
import { Icon } from "./Icon";
import { Media } from "./Media";
import { OverlayPill } from "./Primitives";
import { StoryShell } from "./StoryShell";
import { useToast } from "./Toast";
import { VoteControls } from "./VoteControls";
import { useZoom } from "./zoom";

function primaryGrid(content: Content) {
  return GRID_LIST.reduce((best, g) =>
    content.scores[g.id].confidence > content.scores[best.id].confidence ? g : best,
  );
}

/**
 * One photo from the Home feed, full screen with its info card: no carousel
 * of the other photos, no tap-to-page — just this post. Pinch-zooms like a
 * reel (same `useZoom`), fading the card and close button while zoomed.
 */
export function PhotoViewer({ content, onClose }: { content: Content; onClose: () => void }) {
  const { vote, reactionOf, pendingUntilOf, isVoteLocked } = useStore();
  const author = useAuthor(content.authorId);
  const router = useRouter();
  const toast = useToast();
  const [comments, setComments] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const zoom = useZoom(stage.width, stage.height);

  const own = author.isMe;
  const myVote = reactionOf(content.id);
  const grid = primaryGrid(content);

  const share = async () => {
    try {
      await Share.share({ message: `"${content.text}" — @${author.handle} on PNYX` });
    } catch {
      toast("Couldn't share that one");
    }
  };

  return (
    <StoryShell
      open
      paging={false}
      count={1}
      index={0}
      onIndexChange={() => {}}
      onClose={onClose}
      chromeStyle={zoom.chromeStyle}
      media={
        <GestureDetector gesture={zoom.pinch}>
          <Animated.View
            style={[styles.stage, zoom.style]}
            onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
          >
            <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} fill playing={false} />
          </Animated.View>
        </GestureDetector>
      }
    >
      <View style={[styles.card, { marginBottom: TAB_BAR_CLEARANCE }]}>
        <OverlayPill height={26} style={styles.chip}>
          <Text style={styles.chipText}>{grid.label}</Text>
        </OverlayPill>

        <AnimatedPressable
          scaleTo={0.97}
          style={styles.byline}
          accessibilityRole="link"
          accessibilityLabel={`Open ${author.name}'s profile`}
          onPress={() => {
            onClose();
            router.push(own ? "/profile" : { pathname: "/u/[id]", params: { id: author.id } });
          }}
        >
          <Avatar
            name={author.name}
            positions={author.positions}
            size={34}
            locked={author.locked}
            badge={false}
            photoUrl={author.avatarUrl}
          />
          <Text style={styles.name}>{own ? "You" : author.name}</Text>
        </AnimatedPressable>

        <Text style={styles.take}>{content.text}</Text>

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
            onVote={(power) => vote(content.id, power)}
          />
          <OverlayPill onPress={() => setComments(true)} gap={6} accessibilityLabel={`${content.commentCount} comments`}>
            <Icon name="comment" size={16} color={c.onAccent} />
            <Text style={styles.pillCount}>{content.commentCount}</Text>
          </OverlayPill>
          <OverlayPill onPress={share} gap={6} accessibilityLabel="Share this post">
            <Icon name="share" size={16} color={c.onAccent} />
          </OverlayPill>
        </View>

        <Text style={styles.timestamp}>{timeAgoLong(content.createdAt)}</Text>
      </View>

      <CommentsSheet content={content} open={comments} onClose={() => setComments(false)} />
    </StoryShell>
  );
}

const styles = StyleSheet.create({
  stage: { position: "absolute", left: 0, right: 0, top: "16%", bottom: "34%" },
  card: {
    marginHorizontal: s[4],
    padding: s[4],
    borderRadius: r.lg,
    backgroundColor: "rgba(20,19,17,0.9)",
    gap: s[3],
    ...squircle,
  },
  chip: { alignSelf: "flex-start" },
  chipText: { color: c.onAccent, fontSize: f.xs, fontWeight: "600" },
  byline: { flexDirection: "row", alignItems: "center", gap: s[2] },
  name: { color: c.onAccent, fontSize: f.sm, fontFamily: display.semibold },
  take: { color: c.onAccent, fontSize: f.md, fontFamily: display.semibold, lineHeight: 22 },
  actions: { flexDirection: "row", alignItems: "center", gap: s[2] },
  pillCount: { color: c.onAccent, fontSize: f.sm, fontWeight: "600" },
  timestamp: { color: hexToRgba(c.onAccent, 0.5), fontSize: f.xs },
});
