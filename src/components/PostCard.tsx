import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { timeAgo } from "@/lib/format";
import { nearestPoint } from "@/lib/grids";
import type { Content } from "@/lib/types";
import { useStore } from "@/state/store";
import { useAuthor } from "@/state/useAuthor";
import { c, f, s } from "@/theme/tokens";
import { AlignmentPill } from "./Alignment";
import { Avatar } from "./Avatar";
import { CommentsSheet } from "./Comments";
import { Icon } from "./Icon";
import { Media } from "./Media";
import { useToast } from "./Toast";
import { VoteControls } from "./VoteControls";
import { VoteResult } from "./VoteResult";

export function PostCard({ content }: { content: Content }) {
  const { vote, reactionOf, alignmentWith, isFollowing, accent, people, peopleById, myId } = useStore();
  const author = useAuthor(content.authorId);
  const router = useRouter();
  const toast = useToast();
  const [openComments, setOpenComments] = useState(false);

  const myVote = reactionOf(content.id);
  const own = content.authorId === myId;
  const friends = people.filter((p) => isFollowing(p.id));
  const person = own ? null : peopleById[content.authorId];
  const type = nearestPoint("values", author.positions.values);
  const topComment = content.comments[0];

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
        <Pressable
          style={styles.author}
          accessibilityRole="link"
          accessibilityLabel={`Open ${author.name}'s profile`}
          onPress={() => router.push(own ? "/profile" : `/u/${author.id}`)}
        >
          <Avatar name={author.name} positions={author.positions} size={40} locked={author.locked} />
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>
              {author.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              @{author.handle} · {author.locked ? "Unrevealed" : type.name} · {timeAgo(content.createdAt)}
            </Text>
          </View>
        </Pressable>
        {person && <AlignmentPill value={alignmentWith(person)} />}
      </View>

      {content.type === "image" ? (
        <>
          <Media id={content.id} scores={content.scores} mediaUrl={content.mediaUrl} />
          <Text style={styles.caption}>{content.text}</Text>
        </>
      ) : (
        <View style={[styles.takeWrap, { borderLeftColor: accent }]}>
          <Text style={styles.take}>{content.text}</Text>
        </View>
      )}

      {content.context && <Text style={styles.context}>{content.context}</Text>}

      <View style={styles.actions}>
        <VoteControls
          current={myVote}
          onVote={(power) => void vote(content.id, power)}
          disabled={own}
          onDisabledPress={() => toast("You can't vote on your own posts")}
        />
        <View style={styles.secondary}>
          <Pressable
            onPress={() => setOpenComments(true)}
            style={styles.ghost}
            accessibilityRole="button"
            accessibilityLabel={`${content.comments.length} comments`}
          >
            <Icon name="comment" size={18} color={c.textDim} />
            <Text style={styles.ghostText}>{content.comments.length}</Text>
          </Pressable>
          <Pressable
            onPress={share}
            style={styles.ghost}
            accessibilityRole="button"
            accessibilityLabel="Share this post"
          >
            <Icon name="share" size={18} color={c.textDim} />
          </Pressable>
        </View>
      </View>

      {own && (
        <Text style={styles.note}>
          {content.moderationStatus === "pending"
            ? "In review — only you can see this until it is approved."
            : "Your own post — voting is disabled."}
        </Text>
      )}

      {myVote !== undefined && !own && <VoteResult content={content} friends={friends} myVote={myVote} />}

      {topComment && (
        <Pressable onPress={() => setOpenComments(true)} accessibilityRole="button">
          <Text style={styles.topComment} numberOfLines={2}>
            <Text style={styles.topCommentWho}>@{peopleById[topComment.authorId]?.handle ?? "someone"} </Text>
            {topComment.text}
          </Text>
        </Pressable>
      )}

      <CommentsSheet content={content} open={openComments} onClose={() => setOpenComments(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  post: { gap: s[3] },
  head: { flexDirection: "row", alignItems: "center", gap: s[3] },
  author: { flexDirection: "row", alignItems: "center", gap: s[3], flex: 1 },
  who: { flex: 1 },
  name: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  meta: { color: c.textFaint, fontSize: f.xs },
  takeWrap: { paddingLeft: s[4], borderLeftWidth: 2 },
  take: { color: c.text, fontSize: 21, fontWeight: "600", lineHeight: 27, letterSpacing: -0.3 },
  caption: { color: c.text, fontSize: f.md, lineHeight: 22 },
  context: { color: c.textFaint, fontSize: f.xs },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: s[3] },
  secondary: { flexDirection: "row", alignItems: "center", gap: s[1] },
  ghost: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: s[3] },
  ghostText: { color: c.textDim, fontSize: f.sm },
  note: { color: c.textFaint, fontSize: f.xs },
  topComment: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  topCommentWho: { color: c.text, fontWeight: "500" },
});
