import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { HOT_TAKES } from "@/lib/data";
import type { HotTake } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";

/** Real, still-active hot takes in remote mode; the sample set offline. */
export function useHotTakes() {
  const { mode } = useStore();
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
      setItems(
        res.items.map((r) => ({
          id: r.id,
          authorId: r.authorId,
          text: r.body,
          category: r.category,
          up: r.up,
          down: r.down,
          comments: r.comments,
          createdAt: Date.parse(r.createdAt),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [remote, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items: items ?? [], loading, refresh: load };
}
