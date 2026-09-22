import { useCallback, useEffect, useState } from "react";
import { track } from "@/analytics/analytics";
import { api } from "@/api/client";
import { CONVERSATIONS } from "@/lib/data";
import type { ChatMessage, VotePower } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";
import { fromApiMessage } from "./useConversations";

/** The 1:1 thread with `personId` — opened (get-or-create) in remote mode,
 * the matching sample conversation offline. */
export function useConversation(personId: string) {
  const { mode, myId } = useStore();
  const { token } = useSession();
  const remote = mode === "remote";

  const seed = !remote ? CONVERSATIONS.find((x) => x.personId === personId) : undefined;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [remoteMessages, setRemoteMessages] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(remote);
  const [notFound, setNotFound] = useState(false);
  const [localExtra, setLocalExtra] = useState<ChatMessage[]>([]);

  const load = useCallback(async () => {
    if (!remote) return;
    const t = await token();
    if (!t) return;
    setLoading(true);
    try {
      const res = await api.openConversation(t, personId);
      setConversationId(res.conversationId);
      setRemoteMessages(res.messages.map(fromApiMessage));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [remote, token, personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const messages: ChatMessage[] = remote ? (remoteMessages ?? []) : [...(seed?.messages ?? []), ...localExtra];
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
      setRemoteMessages((prev) => [...(prev ?? []), fromApiMessage(row)]);
      track("message_sent");
    },
    [remote, token, conversationId, myId],
  );

  return { messages, loading, found, send };
}
