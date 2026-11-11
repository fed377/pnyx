import { useCallback, useState } from "react";
import { track } from "@/analytics/analytics";
import { api, ApiError } from "@/api/client";
import { CONVERSATIONS } from "@/lib/data";
import type { ChatMessage, VotePower } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";
import { fromApiMessage } from "./useConversations";
import { useRemote } from "./useRemote";

/** The 1:1 thread with `personId` — opened (get-or-create) in remote mode,
 * the matching sample conversation offline. */
export function useConversation(personId: string) {
  const { mode, myId } = useStore();
  const { token, authed } = useSession();
  const remote = mode === "remote";

  const seed = !remote ? CONVERSATIONS.find((x) => x.personId === personId) : undefined;

  const fetch = useCallback(async () => {
    const res = await authed((t) => api.openConversation(t, personId));
    return res ? { conversationId: res.conversationId, messages: res.messages.map(fromApiMessage) } : null;
  }, [authed, personId]);
  const { data, loading, error, refresh, mutate } = useRemote(remote ? personId : null, fetch);
  const [localExtra, setLocalExtra] = useState<ChatMessage[]>([]);
  const conversationId = data?.conversationId ?? null;

  // Only a missing person means there's no thread; anything else can be retried.
  const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
  const messages: ChatMessage[] = remote ? (data?.messages ?? []) : [...(seed?.messages ?? []), ...localExtra];
  const found = remote ? !notFound : seed !== undefined;

  const send = useCallback(
    async (input: { text?: string; contentId?: string; votePower?: VotePower }) => {
      if (!remote) {
        setLocalExtra((x) => [
          ...x,
          { id: `local-${Date.now()}`, from: myId, text: input.text, contentId: input.contentId, vote: input.votePower, at: Date.now() },
        ]);
        track("message_sent");
        return;
      }
      const t = await token();
      if (!t || !conversationId) return;
      const row = await api.sendMessage(t, conversationId, {
        body: input.text,
        contentId: input.contentId,
        votePower: input.votePower,
      });
      mutate((prev) => prev && { ...prev, messages: [...prev.messages, fromApiMessage(row)] });
      track("message_sent");
    },
    [remote, token, conversationId, myId, mutate, setLocalExtra],
  );

  return { messages, loading, failed: error !== null && !notFound, found, refresh, send };
}
