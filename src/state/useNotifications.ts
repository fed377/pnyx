import { useCallback } from "react";
import { api } from "@/api/client";
import { NOTIFICATIONS } from "@/lib/data";
import type { Notification } from "@/lib/data";
import { useSession } from "./session";
import { useStore } from "./store";
import { useRemote } from "./useRemote";

/**
 * Real notifications in remote mode; the sample set offline, same as
 * everywhere else. Pass `enabled: false` (default true) to skip the fetch
 * entirely — for a TopBar rendered without its notifications badge, say.
 */
export function useNotifications(enabled = true) {
  const { mode, myId } = useStore();
  const { authed } = useSession();
  const remote = mode === "remote" && enabled;

  const fetch = useCallback(async () => {
    const res = await authed((t) => api.notifications(t));
    return res
      ? res.items.map(
          (n): Notification => ({
            id: n.id,
            personId: n.actorId ?? "",
            text: n.body,
            at: Date.parse(n.createdAt),
            kind: n.kind,
            pct: n.pct,
            contentId: n.contentId,
          }),
        )
      : null;
  }, [authed]);
  const { data, loading, error, refresh } = useRemote(remote ? myId : null, fetch);

  return {
    items: remote ? (data ?? []) : enabled ? NOTIFICATIONS : [],
    loading,
    failed: error !== null,
    refresh,
  };
}
