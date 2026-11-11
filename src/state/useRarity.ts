import { useCallback } from "react";
import { api } from "@/api/client";
import { hashSeed } from "@/lib/format";
import type { GridId } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";
import { useRemote } from "./useRemote";

/** No real population to compare against offline — same hash-based stand-in
 * Statistics has always shown in sample mode. */
function placeholder(label: string): number {
  return 3 + Math.floor(hashSeed(label) * 900);
}

/**
 * "Shared by only 3 people worldwide" — real population rarity per
 * grid in remote mode, the same placeholder as before offline (there's simply
 * no population to measure against there).
 */
export function useRarity() {
  const { mode, unlocked, myId } = useStore();
  const { authed } = useSession();
  const remote = mode === "remote" && unlocked;

  const fetch = useCallback(() => authed((t) => api.rarity(t)), [authed]);
  // A failure leaves no number rather than a made-up one; the next visit tries again.
  const { data: byGrid, loading } = useRemote(remote ? myId : null, fetch);

  /** `label` (e.g. "Values-Adapt") is the offline fallback's own seed — kept
   * so a caller doesn't need to know which mode it's actually in. Null when the
   * real number hasn't arrived (see `loading`) or couldn't be fetched. */
  const rarity = (gridId: GridId, label: string): number | null =>
    byGrid?.[gridId] ?? (remote ? null : placeholder(label));
  return { rarity, loading };
}
