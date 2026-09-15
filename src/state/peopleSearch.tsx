import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

/**
 * Lives above the tab navigator so the floating bottom bar (which morphs into
 * the search field, per the Figma handoff) and the People screen's list share
 * one query — typing in the bar is what filters the list.
 */
type PeopleSearch = { query: string; setQuery: (q: string) => void };

const PeopleSearchContext = createContext<PeopleSearch | null>(null);

export function PeopleSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <PeopleSearchContext.Provider value={{ query, setQuery }}>{children}</PeopleSearchContext.Provider>;
}

export function usePeopleSearch(): PeopleSearch {
  const ctx = useContext(PeopleSearchContext);
  if (!ctx) throw new Error("usePeopleSearch must be used inside <PeopleSearchProvider>");
  return ctx;
}
