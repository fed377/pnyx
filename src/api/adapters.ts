import { ORIGIN } from "@/lib/algorithm";
import type { Content, Person } from "@/lib/types";
import type { ApiContent, ApiPerson } from "./client";

/**
 * The API speaks in rows; the screens were written against the shape in
 * lib/types. Mapping here keeps every screen unchanged whether the data came
 * from the server or from the built-in sample set.
 */

/** Tallies are raw counts; the UI shows a percentage split. */
function toSplit(t: ApiContent["tallies"]) {
  const total = t.love + t.like + t.dislike + t.hate;
  if (total === 0) return { love: 0, like: 0, dislike: 0, hate: 0 };
  const pct = (n: number) => Math.round((n / total) * 100);
  return { love: pct(t.love), like: pct(t.like), dislike: pct(t.dislike), hate: pct(t.hate) };
}

export function toContent(row: ApiContent): Content {
  return {
    id: row.id,
    authorId: row.authorId,
    type: row.type,
    text: row.body,
    context: row.context,
    music: row.music,
    mediaUrl: row.mediaUrl,
    moderationStatus: row.moderationStatus,
    createdAt: Date.parse(row.createdAt),
    scores: row.scores,
    // Comments are not served by the API yet.
    comments: [],
    globalSplit: toSplit(row.tallies),
  };
}

export function toPerson(row: ApiPerson): Person {
  return {
    id: row.profile.id,
    handle: row.profile.handle,
    name: row.profile.name || row.profile.handle,
    pronouns: row.profile.pronouns,
    bio: row.profile.bio,
    tier: row.profile.privacyTier,
    city: row.profile.city,
    // A private person's coordinates are withheld; they sit at the origin for
    // drawing purposes only — their alignment number still came from the server.
    positions: row.positions ?? ORIGIN,
    voteCount: row.voteCount,
    following: row.following,
    follower: row.follower,
  };
}
