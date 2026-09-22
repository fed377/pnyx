import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { timeAgo } from "@/lib/format";
import { GRID_LIST } from "@/lib/grids";
import type { Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { c, display, f, r, s, squircle } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Avatar } from "./Avatar";
import { CommentsSheet } from "./Comments";
import { Icon } from "./Icon";
import { isVideoUrl, Media } from "./Media";
import { Chip } from "./Primitives";
import { useToast } from "./Toast";
import { VoteControls } from "./VoteControls";
import { VoteResult } from "./VoteResult";

/** The grid this post's scores are most confident on — shown as the card's category chip. */
function primaryGrid(content: Content) {
  return GRID_LIST.reduce((best, g) =>
    content.scores[g.id].confidence > content.scores[best.id].confidence ? g : best,
  );
}

/**
 * Video posts show as a paused thumbnail until tapped, instead of autoplaying
 * inline. Seeded posts without a real video file fall back to Media's
 * generated art — nothing to play there, so no tap affordance is shown.
 */
function VideoThumb({ content }: { content: Content }) {
  const [playing, setPlaying] = useState(false);
  const hasVideo = isVideoUrl(content.mediaUrl);

  if (!hasVideo) {
    return <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} playing={false} />;
  }

  return (
    <AnimatedPressable
      onPress={() => setPlaying((p) => !p)}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={playing ? "Pause video" : "Play video"}
    >
      <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} playing={playing} />
      {!playing && (
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playBtn}>
            <Icon name="play" size={22} color={c.text} filled />
          </View>
        </View>
      )}
    </AnimatedPressable>
  );
}

export function PostCard({
  content,
  onOpenPhoto,
}: {
  content: Content;
  /** Opens the full-screen photo viewer at this post, when it has an image. */
  onOpenPhoto?: (id: string) => void;
}) {
  const { vote, reactionOf, pendingUntilOf, isVoteLocked, alignmentWith, isFollowing, people, peopleById, myId } =
    useStore();
  const author = useAuthor(content.authorId);
  const router = useRouter();
  const toast = useToast();
  const [openComments, setOpenComments] = useState(false);

  const myVote = reactionOf(content.id);
  const own = content.authorId === myId;
  const friends = people.filter((p) => isFollowing(p.id));
  const person = own ? null : peopleById[content.authorId];
  const topComment = content.comments[0];
  const grid = useMemo(() => primaryGrid(content), [content]);

  const share = async () => {
    try {
      await Share.share({ message: `"${content.text}" — @${author.handle} on PNYX` });
    } catch {
      toast("Couldn't share that one");
    }
  };

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <Chip label={grid.label} />
        <AnimatedPressable
          scaleTo={0.98}
          style={styles.author}
          accessibilityRole="link"
          accessibilityLabel={`Open ${author.name}'s profile`}
          onPress={() => router.push(own ? "/profile" : `/u/${author.id}`)}
        >
          <Avatar
            name={author.name}
            positions={author.positions}
            size={22}
            locked={author.locked}
            badge={false}
            photoUrl={author.avatarUrl}
          />
          <Text style={styles.name} numberOfLines={1}>
            {own ? "You" : author.name}
            {person && <Text style={styles.namePct}> · {Math.round(alignmentWith(person))}%</Text>}
          </Text>
        </AnimatedPressable>
      </View>

      {content.type === "video" ? (
        <>
          <VideoThumb content={content} />
          <Text style={styles.caption}>{content.text}</Text>
        </>
      ) : content.type === "image" ? (
        <>
          <AnimatedPressable
            onPress={() => onOpenPhoto?.(content.id)}
            scaleTo={0.98}
            disabled={!onOpenPhoto}
            accessibilityRole="button"
            accessibilityLabel="Open photo"
          >
            <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} />
          </AnimatedPressable>
          <Text style={styles.caption}>{content.text}</Text>
        </>
      ) : (
        <Text style={styles.take}>{content.text}</Text>
      )}

      {content.context && <Text style={styles.context}>{content.context}</Text>}

      <View style={styles.actions}>
        <VoteControls
          current={myVote}
          pendingUntil={pendingUntilOf(content.id)}
          locked={isVoteLocked(content.id)}
          onLockedPress={() => toast("Your vote is counted — it can't be changed")}
          onVote={(power) => vote(content.id, power)}
          disabled={own}
        />
        <View style={styles.secondary}>
          <AnimatedPressable
            onPress={() => setOpenComments(true)}
            scaleTo={0.9}
            style={styles.ghost}
            // 34pt tall — 10pt under the 44pt iOS minimum, made up invisibly
            // here rather than by growing the visible pill.
            hitSlop={5}
            accessibilityRole="button"
            accessibilityLabel={`${content.commentCount} comments`}
          >
            <Icon name="comment" size={18} color={c.text} />
            <Text style={styles.ghostText}>{content.commentCount}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={share}
            scaleTo={0.9}
            style={styles.ghost}
            hitSlop={5}
            accessibilityRole="button"
            accessibilityLabel="Share this post"
          >
            <Icon name="share" size={18} color={c.text} />
          </AnimatedPressable>
        </View>
      </View>

      <Text style={styles.timestamp}>{timeAgo(content.createdAt)}</Text>

      {own && (
        <Text style={styles.note}>
          {content.moderationStatus === "pending"
            ? "In review — only you can see this until it is approved."
            : "Your own post — voting is disabled."}
        </Text>
      )}

      {myVote !== undefined && !own && <VoteResult content={content} friends={friends} myVote={myVote} />}

      {topComment && (
        <AnimatedPressable onPress={() => setOpenComments(true)} scaleTo={0.98} accessibilityRole="button">
          <Text style={styles.topComment} numberOfLines={2}>
            <Text style={styles.topCommentWho}>@{peopleById[topComment.authorId]?.handle ?? "someone"} </Text>
            {topComment.text}
          </Text>
        </AnimatedPressable>
      )}

      <CommentsSheet content={content} open={openComments} onClose={() => setOpenComments(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    gap: s[3],
    padding: s[4],
    borderRadius: r.lg,
    backgroundColor: c.surface,
    ...squircle,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s[3] },
  author: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingRight: s[3],
    paddingVertical: 4,
    borderRadius: r.full,
    backgroundColor: c.surface3,
    ...squircle,
  },
  name: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  namePct: { color: c.text, fontWeight: "600" },
  take: { color: c.text, fontSize: 21, fontFamily: display.semibold, lineHeight: 27, letterSpacing: -0.3 },
  caption: { color: c.text, fontSize: f.md, fontWeight: "500", lineHeight: 22 },
  timestamp: { color: c.textFaint, fontSize: f.xs },
  playOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: r.full,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
    backgroundColor: c.surface3,
  },
  context: { color: c.textFaint, fontSize: f.xs },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s[3] },
  secondary: { flexDirection: "row", alignItems: "center", gap: s[1] },
  ghost: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: s[3] },
  ghostText: { color: c.textDim, fontSize: f.sm },
  note: { color: c.textFaint, fontSize: f.xs },
  topComment: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  topCommentWho: { color: c.text, fontWeight: "500" },
});
