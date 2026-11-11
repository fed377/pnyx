import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Person, VotePower } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";

/**
 * Shown once you vote: real cast votes from people the caller follows, in
 * remote mode. Returns `null` in local/offline mode,
 * where there is no real vote to look up at all (the caller falls back to
 * `friendVotes()` in `lib/feed.ts`, an affinity-based guess that only ever
 * made sense as an offline stand-in).
 */
export function useFriendVotes(contentId: string): { person: Person; power: VotePower }[] | null {
  const { mode, peopleById } = useStore();
  const { authed } = useSession();
  const remote = mode === "remote";

  // Keyed by post, so a recycled card never shows the last post's friends.
  const [loaded, setLoaded] = useState<{ contentId: string; items: { userId: string; power: VotePower }[] } | null>(null);

  useEffect(() => {
    if (!remote) return;
    let alive = true;
    void (async () => {
      const res = await authed((t) => api.friendVotes(t, contentId));
      if (res && alive) setLoaded({ contentId, items: res.items });
    })().catch(() => {
      // Friends' votes are a bonus on the result card; it renders without them.
    });
    return () => {
      alive = false;
    };
  }, [remote, contentId, authed]);

  if (!remote) return null;
  if (loaded === null || loaded.contentId !== contentId) return [];
  return loaded.items.flatMap(({ userId, power }) => {
    const person = peopleById[userId];
    return person ? [{ person, power }] : [];
  });
}
