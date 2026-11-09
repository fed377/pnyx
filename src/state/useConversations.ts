import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import type { ApiMessage } from "@/api/client";
import { CONVERSATIONS } from "@/lib/data";
import type { ChatMessage, Conversation } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";

export const fromApiMessage = (m: ApiMessage): ChatMessage => ({
  id: m.id,
  from: m.senderId,
  text: m.body,
  contentId: m.contentId,
  vote: m.voteSnapshot,
  at: Date.parse(m.createdAt),
});

/**
 * One row per thread, newest activity first — real conversations in remote
 * mode, the sample set offline. `Conversation.id` is routed on as the *other
 * person's* id, not the conversation row's id, so a thread can be opened
 * (get-or-create) from anywhere you know a person, without needing to have
 * already fetched a conversation id for them.
 */
export function useConversations() {
  const { mode } = useStore();
  const { authed } = useSession();
  const remote = mode === "remote";

  const [items, setItems] = useState<Conversation[] | null>(remote ? null : CONVERSATIONS);
  const [loading, setLoading] = useState(remote);

  const load = useCallback(async () => {
    if (!remote) {
      setItems(CONVERSATIONS);
      return;
    }
    setLoading(true);
    try {
      const res = await authed((t) => api.conversations(t));
      if (!res) return;
      setItems(
        res.items.map((c) => ({
          id: c.otherUserId,
          personId: c.otherUserId,
          messages: c.lastMessage ? [fromApiMessage(c.lastMessage)] : [],
        })),
      );
    } catch {
      // Leave what's on screen; the next load tries again.
    } finally {
      setLoading(false);
    }
  }, [remote, authed]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items: items ?? [], loading, refresh: load };
}
