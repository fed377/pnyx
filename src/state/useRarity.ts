import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { hashSeed } from "@/lib/format";
import type { GridId } from "@/lib/types";
import { useSession } from "./session";
import { useStore } from "./store";

/** No real population to compare against offline — same hash-based stand-in
 * Statistics has always shown in sample mode. */
function placeholder(label: string): number {
  return 3 + Math.floor(hashSeed(label) * 900);
}

/**
 * Spec §6.6: "shared by only 3 people worldwide" — real population rarity per
 * grid in remote mode, the same placeholder as before offline (there's simply
 * no population to measure against there).
 */
export function useRarity() {
  const { mode, unlocked } = useStore();
  const { token } = useSession();
  const remote = mode === "remote" && unlocked;

  const [byGrid, setByGrid] = useState<Record<GridId, number> | null>(null);

  const load = useCallback(async () => {
    if (!remote) {
      setByGrid(null);
      return;
    }
    const t = await token();
    if (!t) return;
    setByGrid(await api.rarity(t));
  }, [remote, token]);

  useEffect(() => {
    void load();
  }, [load]);

  /** `label` (e.g. "Values-Adapt") is the offline fallback's own seed — kept
   * so a caller doesn't need to know which mode it's actually in. */
  return (gridId: GridId, label: string): number => byGrid?.[gridId] ?? placeholder(label);
}
