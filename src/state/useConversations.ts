import { useCallback } from "react";
import { api } from "@/api/client";
import type { ApiMessage } from "@/api/client";
import { CONVERSATIONS } from "@/lib/data";
import type { ChatMessage, Conversation } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";
import { useRemote } from "./useRemote";

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
  const { mode, myId } = useStore();
  const { authed } = useSession();
  const remote = mode === "remote";

  const fetch = useCallback(async () => {
    const res = await authed((t) => api.conversations(t));
    return res
      ? res.items.map(
          (c): Conversation => ({
            id: c.otherUserId,
            personId: c.otherUserId,
            messages: c.lastMessage ? [fromApiMessage(c.lastMessage)] : [],
          }),
        )
      : null;
  }, [authed]);
  const { data, loading, error, refresh } = useRemote(remote ? myId : null, fetch);

  return {
    items: remote ? (data ?? []) : CONVERSATIONS,
    loading,
    failed: error !== null,
    refresh,
  };
}
