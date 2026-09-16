import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import type { ApiComment } from "@/api/client";
import type { Comment } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";

export type LiveComment = {
  id: string;
  authorId: string;
  text: string;
  up: number;
  down: number;
  at: number;
  /** This viewer's own agree/disagree — always known locally, fetched remotely. */
  myVote: 1 | -1 | null;
};

const fromApi = (r: ApiComment): LiveComment => ({
  id: r.id,
  authorId: r.authorId,
  text: r.body,
  up: r.up,
  down: r.down,
  at: Date.parse(r.createdAt),
  myVote: r.myVote,
});

/**
 * Real comments in remote mode (fetched from `/content/:id/comments`, votes
 * cast through `/comments/:id/vote`); offline, the same shape backed by
 * in-memory-only state, same as before — there is nowhere to persist to.
 */
export function useComments(contentId: string, seed: Comment[], seedAt: number) {
  const { mode, myId, bumpCommentCount } = useStore();
  const { token } = useSession();
  const remote = mode === "remote";

  const [remoteItems, setRemoteItems] = useState<LiveComment[] | null>(null);
  const [loading, setLoading] = useState(remote);
  const [localAdded, setLocalAdded] = useState<LiveComment[]>([]);
  const [localVotes, setLocalVotes] = useState<Record<string, 1 | -1>>({});

  const load = useCallback(async () => {
    if (!remote) return;
    const t = await token();
    if (!t) return;
    setLoading(true);
    try {
      const res = await api.comments(t, contentId);
      setRemoteItems(res.items.map(fromApi));
    } finally {
      setLoading(false);
    }
  }, [remote, token, contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items: LiveComment[] = remote
    ? (remoteItems ?? [])
    : [
        ...localAdded,
        ...seed.map((c) => {
          const myVote = localVotes[c.id] ?? null;
          return {
            id: c.id,
            authorId: c.authorId,
            text: c.text,
            up: c.up + (myVote === 1 ? 1 : 0),
            down: c.down + (myVote === -1 ? 1 : 0),
            at: seedAt,
            myVote,
          };
        }),
      ];

  const addComment = useCallback(
    async (text: string) => {
      if (!remote) {
        setLocalAdded((a) => [
          { id: `local-${Date.now()}`, authorId: myId, text, up: 0, down: 0, at: Date.now(), myVote: null },
          ...a,
        ]);
        return;
      }
      const t = await token();
      if (!t) return;
      const row = await api.addComment(t, contentId, text);
      setRemoteItems((prev) => [...(prev ?? []), fromApi(row)]);
      bumpCommentCount(contentId);
    },
    [remote, token, contentId, myId, bumpCommentCount],
  );

  const castVote = useCallback(
    async (commentId: string, power: 1 | -1) => {
      if (!remote) {
        setLocalVotes((v) => {
          const next = { ...v };
          if (next[commentId] === power) delete next[commentId];
          else next[commentId] = power;
          return next;
        });
        return;
      }
      const t = await token();
      if (!t) return;
      const res = await api.voteComment(t, commentId, power);
      setRemoteItems((prev) =>
        prev ? prev.map((c) => (c.id === commentId ? { ...c, up: res.up, down: res.down, myVote: res.myVote } : c)) : prev,
      );
    },
    [remote, token, contentId],
  );

  return { items, loading, addComment, castVote };
}
