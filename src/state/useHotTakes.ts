import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { HOT_TAKES } from "@/lib/data";
import type { GridId, HotTake } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";

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
  const { token } = useSession();
  const remote = mode === "remote";

  const [items, setItems] = useState<HotTake[] | null>(remote ? null : HOT_TAKES);
  const [loading, setLoading] = useState(remote);

  const load = useCallback(async () => {
    if (!remote) {
      setItems(HOT_TAKES);
      return;
    }
    const t = await token();
    if (!t) return;
    setLoading(true);
    try {
      const res = await api.hotTakes(t);
      setItems(res.items.map(fromApi));
    } finally {
      setLoading(false);
    }
  }, [remote, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (category: GridId, text: string) => {
      if (!remote) {
        // Offline there is nowhere to post to — a local-only stub, same
        // fallback `publish` uses for an offline post.
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
        setItems((prev) => [stub, ...(prev ?? [])]);
        return;
      }
      const t = await token();
      if (!t) throw new Error("not signed in");
      const row = await api.postHotTake(t, category, text);
      setItems((prev) => [fromApi(row), ...(prev ?? [])]);
    },
    [remote, token, myId],
  );

  return { items: items ?? [], loading, refresh: load, post };
}
