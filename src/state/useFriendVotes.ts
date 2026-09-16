import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Person, VotePower } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";

/**
 * Spec §6.2: "on vote, show ... friends' votes" — real cast votes from people
 * the caller follows, in remote mode. Returns `null` in local/offline mode,
 * where there is no real vote to look up at all (the caller falls back to
 * `friendVotes()` in `lib/feed.ts`, an affinity-based guess that only ever
 * made sense as an offline stand-in).
 */
export function useFriendVotes(contentId: string): { person: Person; power: VotePower }[] | null {
  const { mode, peopleById } = useStore();
  const { token } = useSession();
  const remote = mode === "remote";

  const [items, setItems] = useState<{ userId: string; power: VotePower }[] | null>(null);

  useEffect(() => {
    if (!remote) {
      setItems(null);
      return;
    }
    let alive = true;
    void (async () => {
      const t = await token();
      if (!t) return;
      const res = await api.friendVotes(t, contentId);
      if (alive) setItems(res.items);
    })();
    return () => {
      alive = false;
    };
  }, [remote, contentId, token]);

  if (!remote) return null;
  if (items === null) return [];
  return items.flatMap(({ userId, power }) => {
    const person = peopleById[userId];
    return person ? [{ person, power }] : [];
  });
}
