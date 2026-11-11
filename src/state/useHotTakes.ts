import { useCallback, useState } from "react";
import { track } from "@/analytics/analytics";
import { api } from "@/api/client";
import { HOT_TAKES } from "@/lib/data";
import type { GridId, HotTake } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";
import { useRemote } from "./useRemote";

const fromApi = (r: Awaited<ReturnType<typeof api.postHotTake>>): HotTake => ({
  id: r.id,
  authorId: r.authorId,
  text: r.body,
  category: r.category,
  up: r.up,
  down: r.down,
  comments: r.comments,
  createdAt: Date.parse(r.createdAt),
});

/** Real, still-active hot takes in remote mode; the sample set offline. */
export function useHotTakes() {
  const { mode, myId } = useStore();
  const { token, authed } = useSession();
  const remote = mode === "remote";

  const fetch = useCallback(async () => {
    const res = await authed((t) => api.hotTakes(t));
    return res ? res.items.map(fromApi) : null;
  }, [authed]);
  const { data, loading, error, refresh, mutate } = useRemote(remote ? myId : null, fetch);
  // Offline there is nowhere to post to, so posted takes live here.
  const [localPosted, setLocalPosted] = useState<HotTake[]>([]);

  const post = useCallback(
    async (category: GridId, text: string) => {
      if (!remote) {
        // A local-only stub, same fallback `publish` uses for an offline post.
        const stub: HotTake = {
          id: `local-${Date.now()}`,
          authorId: myId,
          text,
          category,
          up: 0,
          down: 0,
          comments: 0,
          createdAt: Date.now(),
        };
        setLocalPosted((prev) => [stub, ...prev]);
        track("hot_take_posted");
        return;
      }
      const t = await token();
      if (!t) throw new Error("not signed in");
      const row = await api.postHotTake(t, category, text);
      mutate((prev) => [fromApi(row), ...(prev ?? [])]);
      track("hot_take_posted");
    },
    [remote, token, myId, mutate],
  );

  return {
    items: remote ? (data ?? []) : [...localPosted, ...HOT_TAKES],
    loading,
    failed: error !== null,
    refresh,
    post,
  };
}
