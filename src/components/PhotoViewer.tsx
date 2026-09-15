import { useRouter } from "expo-router";
import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { GRID_LIST } from "@/lib/grids";
import { timeAgoLong } from "@/lib/format";
import type { Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { display, f, r, s, squircle, TAB_BAR_CLEARANCE } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Avatar } from "./Avatar";
import { CommentsSheet } from "./Comments";
import { Icon } from "./Icon";
import { Media } from "./Media";
import { StoryShell } from "./StoryShell";
import { useToast } from "./Toast";
import { VoteControls } from "./VoteControls";

function primaryGrid(content: Content) {
  return GRID_LIST.reduce((best, g) =>
    content.scores[g.id].confidence > content.scores[best.id].confidence ? g : best,
  );
}

function Frame({ content, index, onIndexChange, count, onClose }: {
  content: Content;
  index: number;
  onIndexChange: (i: number) => void;
  count: number;
  onClose: () => void;
}) {
  const { vote, reactionOf, pendingUntilOf, isVoteLocked } = useStore();
  const author = useAuthor(content.authorId);
  const router = useRouter();
  const toast = useToast();
  const [comments, setComments] = useState(false);

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
      count={count}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
      media={
        <View style={styles.stage}>
          <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} fill playing={false} />
        </View>
      }
    >
      <View style={[styles.card, { marginBottom: TAB_BAR_CLEARANCE }]}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{grid.label}</Text>
        </View>

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
            onDisabledPress={() => toast("You can't vote on your own post")}
            onVote={(power) => vote(content.id, power)}
          />
          <AnimatedPressable
            onPress={() => setComments(true)}
            scaleTo={0.9}
            style={styles.pill}
            accessibilityRole="button"
            accessibilityLabel={`${content.comments.length} comments`}
          >
            <Icon name="comment" size={16} color="#fff" />
            <Text style={styles.pillCount}>{content.comments.length}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={share}
            scaleTo={0.9}
            style={styles.pill}
            accessibilityRole="button"
            accessibilityLabel="Share this post"
          >
            <Icon name="share" size={16} color="#fff" />
          </AnimatedPressable>
        </View>

        <Text style={styles.timestamp}>{timeAgoLong(content.createdAt)}</Text>
      </View>

      <CommentsSheet content={content} open={comments} onClose={() => setComments(false)} />
    </StoryShell>
  );
}

export function PhotoViewer({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: Content[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const content = items[index];
  if (!content) return null;
  return (
    <Frame
      key={content.id}
      content={content}
      index={index}
      onIndexChange={onIndexChange}
      count={items.length}
      onClose={onClose}
    />
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
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: s[3],
    height: 26,
    borderRadius: r.full,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    ...squircle,
  },
  chipText: { color: "#fff", fontSize: f.xs, fontWeight: "600" },
  byline: { flexDirection: "row", alignItems: "center", gap: s[2] },
  name: { color: "#fff", fontSize: f.sm, fontFamily: display.semibold },
  take: { color: "#fff", fontSize: f.md, fontFamily: display.semibold, lineHeight: 22 },
  actions: { flexDirection: "row", alignItems: "center", gap: s[2] },
  pill: {
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
