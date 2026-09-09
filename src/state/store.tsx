import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { api, uploadToSignedUrl } from "@/api/client";
import { toContent, toPerson } from "@/api/adapters";
import { computePositions, totalAlignment, UNLOCK_AT } from "@/lib/algorithm";
import { ALL_CONTENT, ME_DEFAULTS, ME_ID, PEOPLE, POSTS, REELS } from "@/lib/data";
import { GRID_IDS, nearestPoint } from "@/lib/grids";
import type { Content, GridId, Person, Positions, PrivacyTier, Vote, VotePower } from "@/lib/types";
import { DEFAULT_ACCENT, hexToRgba } from "@/theme/tokens";
import { useSession } from "./session";

const STORAGE_KEY = "pnyx.state.v1";

export type Profile = {
  handle: string;
  name: string;
  pronouns: string;
  bio: string;
  city: string;
  tier: PrivacyTier;
};

type State = {
  profile: Profile;
  votes: Vote[];
  /** contentId → the vote cast on it, for showing the current reaction. */
  reactions: Record<string, VotePower>;
  follows: Record<string, boolean>;
  gridPublic: Record<GridId, boolean>;
  myPosts: Content[];
  premium: boolean;
  /** Minimum alignment % for the filter used across Home and People. */
  alignmentFilter: number;
};

const initialFollows = Object.fromEntries(PEOPLE.map((p) => [p.id, p.following]));

const initialState: State = {
  profile: { ...ME_DEFAULTS, tier: "active" },
  votes: [],
  reactions: {},
  follows: initialFollows,
  gridPublic: { values: true, mind: true, soul: true, culture: false, focus: true },
  myPosts: [],
  premium: false,
  alignmentFilter: 0,
};

type Action =
  | { type: "hydrate"; state: State }
  | { type: "vote"; contentId: string; power: VotePower; scores: Content["scores"] }
  | { type: "serverVotes"; votes: Vote[] }
  | { type: "toggleFollow"; personId: string }
  | { type: "setFollow"; personId: string; following: boolean }
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "gridPublic"; grid: GridId; value: boolean }
  | { type: "filter"; value: number }
  | { type: "premium"; value: boolean }
  | { type: "post"; content: Content }
  | { type: "forget" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "vote": {
      const votes = state.votes.filter((v) => v.contentId !== action.contentId);
      votes.push({ contentId: action.contentId, power: action.power, at: Date.now(), scores: action.scores });
      return { ...state, votes, reactions: { ...state.reactions, [action.contentId]: action.power } };
    }
    case "serverVotes": {
      const reactions: Record<string, VotePower> = {};
      for (const v of action.votes) reactions[v.contentId] = v.power;
      return { ...state, votes: action.votes, reactions };
    }
    case "toggleFollow":
      return { ...state, follows: { ...state.follows, [action.personId]: !state.follows[action.personId] } };
    case "setFollow":
      return { ...state, follows: { ...state.follows, [action.personId]: action.following } };
    case "profile":
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case "gridPublic":
      return { ...state, gridPublic: { ...state.gridPublic, [action.grid]: action.value } };
    case "filter":
      return { ...state, alignmentFilter: action.value };
    case "premium":
      return { ...state, premium: action.value };
    case "post":
      return { ...state, myPosts: [action.content, ...state.myPosts] };
    case "forget":
      return { ...initialState, profile: { ...ME_DEFAULTS, tier: "active" } };
    default:
      return state;
  }
}

function merge(raw: string): State {
  const parsed = JSON.parse(raw) as Partial<State>;
  return {
    ...initialState,
    ...parsed,
    profile: { ...initialState.profile, ...parsed.profile },
    gridPublic: { ...initialState.gridPublic, ...parsed.gridPublic },
    follows: { ...initialFollows, ...parsed.follows },
  };
}

/** Every new post carries media now; text-only creation was removed. */
export type PublishInput = {
  type: "image" | "video";
  body: string;
  categories: GridId[];
  /** Local file URI from the picker. */
  fileUri: string;
  mediaType: string;
};

type Store = {
  /** "remote" once signed in against the API; "local" is the offline sample set. */
  mode: "local" | "remote";
  /** The signed-in user's id — a Supabase uuid remotely, the sample id locally. */
  myId: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  state: State;
  dispatch: (a: Action) => void;

  positions: Positions;
  voteCount: number;
  unlocked: boolean;
  unlockProgress: number;

  accent: string;
  accentSoft: string;
  accentLine: string;

  reels: Content[];
  posts: Content[];
  people: Person[];
  peopleById: Record<string, Person>;

  vote: (contentId: string, power: VotePower) => Promise<void>;
  toggleFollow: (personId: string) => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  forgetMe: () => Promise<void>;
  publish: (input: PublishInput) => Promise<void>;

  alignmentWith: (person: Person) => number;
  reactionOf: (contentId: string) => VotePower | undefined;
  isFollowing: (personId: string) => boolean;
  clearStorage: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session, token, configured } = useSession();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = useState(false);

  const remote = configured && session !== null;
  const mode: Store["mode"] = remote ? "remote" : "local";
  const myId = remote ? session.userId : ME_ID;

  // Server-owned slices, only populated in remote mode.
  const [serverPositions, setServerPositions] = useState<Positions | null>(null);
  const [serverVoteCount, setServerVoteCount] = useState(0);
  const [serverContent, setServerContent] = useState<{ reels: Content[]; posts: Content[] } | null>(null);
  const [serverPeople, setServerPeople] = useState<Person[] | null>(null);
  const [alignments, setAlignments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Local persistence (offline mode, and UI preferences in both) ────────── */

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (alive && raw) dispatch({ type: "hydrate", state: merge(raw) });
      })
      .catch(() => {
        // Unreadable store — start fresh rather than blocking the app.
      })
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // Storage full or unavailable — the session still works in memory.
    });
  }, [state, hydrated]);

  /* ── Remote hydration ────────────────────────────────────────────────────── */

  const refresh = useCallback(async () => {
    if (!remote) return;
    const t = await token();
    if (!t) return;

    setLoading(true);
    setError(null);
    try {
      const [me, votes, reels, home, people] = await Promise.all([
        api.me(t),
        api.myVotes(t),
        api.reels(t, 40),
        api.home(t, 40),
        api.people(t, 25),
      ]);

      setServerPositions(me.positions);
      setServerVoteCount(me.voteCount);
      dispatch({
        type: "profile",
        patch: {
          handle: me.handle,
          name: me.name || me.handle,
          pronouns: me.pronouns,
          bio: me.bio,
          city: me.city,
          tier: me.privacyTier,
        },
      });
      dispatch({ type: "serverVotes", votes: votes.items });

      setServerContent({
        reels: reels.items.map(toContent),
        posts: home.items.map(toContent),
      });

      const mapped = people.items.map(toPerson);
      setServerPeople(mapped);
      setAlignments(Object.fromEntries(people.items.map((p) => [p.profile.id, p.total])));
      for (const p of people.items) {
        dispatch({ type: "setFollow", personId: p.profile.id, following: p.following });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [remote, token]);

  // Coming back to the app re-fetches: something may have changed on the server
  // (a post approved, someone else's vote) while it was in the background.
  useEffect(() => {
    if (!remote) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => sub.remove();
  }, [remote, refresh]);

  useEffect(() => {
    if (remote) void refresh();
    else {
      setServerPositions(null);
      setServerContent(null);
      setServerPeople(null);
      setAlignments({});
    }
  }, [remote, refresh]);

  /* ── Derived ─────────────────────────────────────────────────────────────── */

  // Locally the position is replayed from the vote log; remotely the server is
  // authoritative and hands it back with every vote.
  const localPositions = useMemo(() => computePositions(state.votes), [state.votes]);
  const positions = remote ? (serverPositions ?? localPositions) : localPositions;
  const voteCount = remote ? serverVoteCount : state.votes.length;

  const reels = remote ? (serverContent?.reels ?? []) : REELS;

  // Your own posts are kept locally so they appear the moment you publish, but a
  // post the server is already serving must not be listed twice — the server's
  // copy wins, because it carries the real moderation status and tallies.
  const posts = useMemo(() => {
    const fromServer = remote ? (serverContent?.posts ?? []) : POSTS;
    if (!remote) return fromServer;
    const served = new Set(fromServer.map((p) => p.id));
    const notYetServed = state.myPosts.filter((p) => !served.has(p.id));
    return [...notYetServed, ...fromServer];
  }, [remote, serverContent, state.myPosts]);
  const people = remote ? (serverPeople ?? []) : PEOPLE;

  const peopleById = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p])) as Record<string, Person>,
    [people],
  );

  const contentById = useMemo(() => {
    const all = remote ? [...reels, ...posts, ...state.myPosts] : [...ALL_CONTENT, ...state.myPosts];
    return Object.fromEntries(all.map((c) => [c.id, c])) as Record<string, Content>;
  }, [remote, reels, posts, state.myPosts]);

  const vote = useCallback(
    async (contentId: string, power: VotePower) => {
      const content = contentById[contentId];
      if (!content) return;

      if (!remote) {
        dispatch({ type: "vote", contentId, power, scores: content.scores });
        return;
      }

      const t = await token();
      if (!t) return;
      // Show the reaction immediately; the server's position is authoritative
      // and replaces the optimistic one as soon as it answers.
      dispatch({ type: "vote", contentId, power, scores: content.scores });
      try {
        const res = await api.vote(t, contentId, power);
        setServerPositions(res.positions);
        setServerVoteCount(res.voteCount);
      } catch (e) {
        setError(e instanceof Error ? e.message : "vote failed");
      }
    },
    [contentById, remote, token],
  );

  const toggleFollow = useCallback(
    async (personId: string) => {
      const next = !state.follows[personId];
      dispatch({ type: "setFollow", personId, following: next });
      if (!remote) return;
      const t = await token();
      if (!t) return;
      try {
        await api.follow(t, personId, next);
      } catch {
        dispatch({ type: "setFollow", personId, following: !next });
      }
    },
    [remote, state.follows, token],
  );

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      dispatch({ type: "profile", patch });
      if (!remote) return;
      const t = await token();
      if (!t) return;
      try {
        await api.updateMe(t, {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
          ...(patch.pronouns !== undefined ? { pronouns: patch.pronouns } : {}),
          ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
          ...(patch.city !== undefined ? { city: patch.city } : {}),
          ...(patch.tier !== undefined ? { privacyTier: patch.tier } : {}),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not save your profile");
      }
    },
    [remote, token],
  );

  const forgetMe = useCallback(async () => {
    if (remote) {
      const t = await token();
      if (t) {
        try {
          await api.forgetMe(t);
        } catch {
          // Deleting locally regardless; the account may already be gone.
        }
      }
    }
    dispatch({ type: "forget" });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clean up
    }
  }, [remote, token]);

  const publish = useCallback(
    async (input: PublishInput) => {
      if (!remote) {
        // Offline there is nowhere to upload to, so the local file URI stands in.
        const build = (g: GridId) =>
          input.categories.includes(g)
            ? { x: positions[g].x, y: positions[g].y, confidence: 0.55 }
            : { x: 0, y: 0, confidence: 0.12 };
        dispatch({
          type: "post",
          content: {
            id: `mine-${Date.now()}`,
            authorId: "me",
            type: input.type,
            text: input.body,
            mediaUrl: input.fileUri,
            createdAt: Date.now(),
            scores: {
              values: build("values"),
              mind: build("mind"),
              soul: build("soul"),
              culture: build("culture"),
              focus: build("focus"),
            },
            comments: [],
            globalSplit: { love: 0, like: 0, dislike: 0, hate: 0 },
          },
        });
        return;
      }

      const t = await token();
      if (!t) throw new Error("not signed in");

      const ticket = await api.uploadTicket(t, input.mediaType);
      await uploadToSignedUrl(ticket.uploadUrl, input.fileUri, input.mediaType);
      const row = await api.createContent(t, {
        type: input.type,
        body: input.body,
        categories: input.categories,
        mediaPath: ticket.path,
        mediaType: input.mediaType,
      });
      dispatch({ type: "post", content: toContent(row) });
    },
    [positions, remote, token],
  );

  const unlocked = voteCount >= UNLOCK_AT;
  const accent = unlocked ? nearestPoint("mind", positions.mind).hex! : DEFAULT_ACCENT;

  const value = useMemo<Store>(
    () => ({
      mode,
      myId,
      loading,
      error,
      refresh,
      state,
      dispatch,
      positions,
      voteCount,
      unlocked,
      unlockProgress: Math.min(1, voteCount / UNLOCK_AT),
      accent,
      accentSoft: hexToRgba(accent, 0.16),
      accentLine: hexToRgba(accent, 0.38),
      reels,
      posts,
      people,
      peopleById,
      vote,
      toggleFollow,
      saveProfile,
      forgetMe,
      publish,
      // Remotely the server's number wins: a private person's coordinates are
      // withheld, so recomputing here would be wrong.
      alignmentWith: (person) => alignments[person.id] ?? totalAlignment(positions, person.positions),
      reactionOf: (contentId) => state.reactions[contentId],
      isFollowing: (personId) => Boolean(state.follows[personId]),
      clearStorage: () => {
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      },
    }),
    [
      mode, myId, loading, error, refresh, state, positions, voteCount, unlocked, accent,
      reels, posts, people, peopleById, vote, toggleFollow, saveProfile, forgetMe, publish, alignments,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export { GRID_IDS };
export type { State };
