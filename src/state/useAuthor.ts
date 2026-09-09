import { ORIGIN } from "@/lib/algorithm";
import type { Positions } from "@/lib/types";
import { useStore } from "./store";

export type Author = {
  id: string;
  name: string;
  handle: string;
  positions: Positions;
  isMe: boolean;
  locked: boolean;
};

export function useAuthor(authorId: string): Author {
  const { state, positions, unlocked, peopleById, myId } = useStore();
  if (authorId === myId) {
    return {
      id: myId,
      name: state.profile.name,
      handle: state.profile.handle,
      positions,
      isMe: true,
      locked: !unlocked,
    };
  }
  const p = peopleById[authorId];
  if (!p) {
    // An author we have not loaded (someone outside your ranked list).
    return { id: authorId, name: "Someone", handle: "unknown", positions: ORIGIN, isMe: false, locked: true };
  }
  return { id: p.id, name: p.name, handle: p.handle, positions: p.positions, isMe: false, locked: false };
}
