import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { NOTIFICATIONS } from "@/lib/data";
import type { Notification } from "@/lib/data";
import { useSession } from "./session";
import { useStore } from "./store";

/**
 * Real notifications in remote mode; the sample set offline, same as
 * everywhere else. Pass `enabled: false` (default true) to skip the fetch
 * entirely — for a TopBar rendered without its notifications badge, say.
 */
export function useNotifications(enabled = true) {
  const { mode } = useStore();
  const { token } = useSession();
  const remote = mode === "remote" && enabled;

  const [items, setItems] = useState<Notification[] | null>(remote ? null : enabled ? NOTIFICATIONS : []);
  const [loading, setLoading] = useState(remote);

  const load = useCallback(async () => {
    if (!enabled) return;
    if (!remote) {
      setItems(NOTIFICATIONS);
      return;
    }
    const t = await token();
    if (!t) return;
    setLoading(true);
    try {
      const res = await api.notifications(t);
      setItems(
        res.items.map((n) => ({
          id: n.id,
          personId: n.actorId ?? "",
          text: n.body,
          at: Date.parse(n.createdAt),
          kind: n.kind,
          pct: n.pct,
          contentId: n.contentId,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [enabled, remote, token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items: items ?? [], loading, refresh: load };
}
