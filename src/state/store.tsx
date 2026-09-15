import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError, uploadToSignedUrl } from "@/api/client";
import { toContent, toPerson, toSplit } from "@/api/adapters";
import { computePositions, totalAlignment, UNLOCK_AT, VOTE_GRACE_MS } from "@/lib/algorithm";
import { ALL_CONTENT, ME_DEFAULTS, ME_ID, PEOPLE, POSTS, REELS } from "@/lib/data";
import { GRID_IDS, nearestPoint } from "@/lib/grids";
import type { Content, GridId, Person, Positions, PrivacyTier, Vote, VotePower } from "@/lib/types";
import { c, mixHex } from "@/theme/tokens";
import { useSession } from "./session";

const STORAGE_KEY = "pnyx.state.v1";

export type Profile = {
  handle: string;
  name: string;
  pronouns: string;
  bio: string;
  city: string;
  tier: PrivacyTier;
  avatarUrl?: string;
};

type State = {
  profile: Profile;
  votes: Vote[];
  /** contentId → the vote cast on it, for showing the current reaction. */
  reactions: Record<string, VotePower>;
  follows: Record<string, boolean>;
  gridPublic: Record<GridId, boolean>;
  /** Local notification preferences — nothing actually delivers push notifications
   * yet, but the toggles themselves are real, persisted state. */
  notifPrefs: { votes: boolean; replies: boolean; alignments: boolean };
  myPosts: Content[];
  premium: boolean;
  /** Minimum alignment % for the filter used across Home and People. */
  alignmentFilter: number;
  /** Has completed the onboarding screen (username, birthday, bio). */
  onboarded: boolean;
  /** Chose "Explore without an account" on the sign-in screen — skips back to
   * it on the next "forget"/log-out instead of leaving the gate permanently open. */
  skipped: boolean;
  /**
   * ISO date (YYYY-MM-DD), self-reported at onboarding. Kept only for the
   * under-16 gate — there's no backend column for it yet (see PNYX
   * Monetization/Spec), so it never leaves the device.
   */
  birthday: string | null;
};

const initialFollows = Object.fromEntries(PEOPLE.map((p) => [p.id, p.following]));

const initialState: State = {
  profile: { ...ME_DEFAULTS, tier: "active" },
  votes: [],
  reactions: {},
  follows: initialFollows,
  gridPublic: { values: true, mind: true, soul: true, culture: false, focus: true },
  notifPrefs: { votes: true, replies: true, alignments: false },
  myPosts: [],
  premium: false,
  alignmentFilter: 0,
  onboarded: false,
  skipped: false,
  birthday: null,
};

type Action =
  | { type: "hydrate"; state: State }
  | { type: "vote"; contentId: string; power: VotePower; scores: Content["scores"] }
  | { type: "serverVotes"; votes: Vote[] }
  | { type: "toggleFollow"; personId: string }
  | { type: "setFollow"; personId: string; following: boolean }
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "gridPublic"; grid: GridId; value: boolean }
  | { type: "notifPref"; key: keyof State["notifPrefs"]; value: boolean }
  | { type: "filter"; value: number }
  | { type: "premium"; value: boolean }
  | { type: "post"; content: Content }
  | { type: "onboard"; birthday: string }
  /** The server's own record of onboarding completion, applied on refresh —
   * unlike "onboard", this never touches birthday (never sent to the server
   * at all) and can be true without this device ever having run Onboarding. */
  | { type: "onboardedFromServer"; value: boolean }
  | { type: "skip" }
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
    case "notifPref":
      return { ...state, notifPrefs: { ...state.notifPrefs, [action.key]: action.value } };
    case "filter":
      return { ...state, alignmentFilter: action.value };
    case "premium":
      return { ...state, premium: action.value };
    case "post":
      return { ...state, myPosts: [action.content, ...state.myPosts] };
    case "onboard":
      return { ...state, onboarded: true, birthday: action.birthday };
    case "onboardedFromServer":
      // One-directional: the server can confirm "yes, already onboarded"
      // (true) but a false here must never un-onboard someone who just
      // finished the form this session, ahead of that PATCH landing.
      return action.value ? { ...state, onboarded: true } : state;
    case "skip":
      return { ...state, skipped: true };
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
    notifPrefs: { ...initialState.notifPrefs, ...parsed.notifPrefs },
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
  /** False until the persisted store has been read back — gates showing onboarding. */
  hydrated: boolean;
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

  reels: Content[];
  posts: Content[];
  people: Person[];
  peopleById: Record<string, Person>;
  contentById: Record<string, Content>;

  /**
   * Casts a reaction — but it doesn't take effect right away. It sits
   * pending for `VOTE_GRACE_MS`, cancellable by calling this again in the
   * same direction; only once the window elapses does it commit into the
   * movement equation and reach the server. See `pendingUntilOf`.
   */
  vote: (contentId: string, power: VotePower) => void;
  toggleFollow: (personId: string) => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  /** Uploads a picked photo (through the same signed-URL flow post media
   * uses) and saves it as the profile's avatar. */
  saveAvatar: (fileUri: string, mediaType: string) => Promise<void>;
  forgetMe: () => Promise<void>;
  publish: (input: PublishInput) => Promise<void>;
  /** Saves the handle and bio (remotely too, when signed in) and records the birthday locally. */
  completeOnboarding: (input: { handle: string; bio: string; birthday: string }) => Promise<void>;

  alignmentWith: (person: Person) => number;
  /** The pending reaction if there is one, else the committed one. */
  reactionOf: (contentId: string) => VotePower | undefined;
  /** When a vote on this content is still pending, the timestamp it commits at. */
  pendingUntilOf: (contentId: string) => number | undefined;
  /**
   * True once a vote has committed. A committed reaction is final: the grace
   * window was the chance to change your mind, and the buttons stop responding.
   */
  isVoteLocked: (contentId: string) => boolean;
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

  // Votes cast but not yet committed (see VOTE_GRACE_MS) — shown immediately,
  // cancellable, and not reflected in state.votes/reactions until the timer
  // fires. Kept in the provider (not component-local state) so the window
  // keeps running as the user scrolls or switches tabs.
  const [pending, setPending] = useState<Record<string, { power: VotePower; commitAt: number }>>({});
  const pendingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(
    () => () => {
      for (const timer of Object.values(pendingTimers.current)) clearTimeout(timer);
    },
    [],
  );

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

  /**
   * Runs an authenticated call with the token already in hand; a token can
   * look locally valid (per `expiresAt`) yet still be rejected server-side —
   * revoked, clock skew, an app left suspended for a while. On a 401, this
   * forces one refresh and retries; a dead refresh token makes session.tsx
   * sign the user out, which this surfaces as `null` for the caller to give
   * up on quietly (AuthGate takes over from there).
   */
  const callWithRetry = useCallback(
    async <T,>(t: string, fn: (tok: string) => Promise<T>): Promise<T | null> => {
      try {
        return await fn(t);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        const fresh = await token(true);
        if (!fresh) return null;
        return await fn(fresh);
      }
    },
    [token],
  );

  /* ── Remote hydration ────────────────────────────────────────────────────── */

  const refresh = useCallback(async () => {
    if (!remote) return;
    const t = await token();
    if (!t) return;

    setLoading(true);
    setError(null);
    try {
      const result = await callWithRetry(t, (tok) =>
        Promise.all([api.me(tok), api.myVotes(tok), api.reels(tok, 40), api.home(tok, 40), api.people(tok, 25)]),
      );
      if (!result) return;
      const [me, votes, reels, home, people] = result;

      setServerPositions(me.positions);
      setServerVoteCount(me.voteCount);
      // Onboarding-completion is an account fact, not a device one — this is
      // what lets a sign-out/sign-in, a reinstall, or a second device see an
      // already-onboarded account correctly instead of showing Onboarding
      // again just because local state doesn't remember it.
      dispatch({ type: "onboardedFromServer", value: me.onboarded });
      dispatch({
        type: "profile",
        patch: {
          handle: me.handle,
          name: me.name || me.handle,
          pronouns: me.pronouns,
          bio: me.bio,
          city: me.city,
          avatarUrl: me.avatarUrl,
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
  }, [remote, token, callWithRetry]);

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
  // copy wins, because it carries the real moderation status and tallies. A
  // video post lands in /feed/reels well before (or instead of) /home, so that
  // counts as "served" too — otherwise Home shows the stale publish-time
  // snapshot forever, out of sync with whatever Feed is correctly showing.
  const posts = useMemo(() => {
    const fromServer = remote ? (serverContent?.posts ?? []) : POSTS;
    if (!remote) return fromServer;
    const served = new Set(fromServer.map((p) => p.id));
    const reelsById = new Map((serverContent?.reels ?? []).map((c) => [c.id, c]));
    const notYetServed = state.myPosts
      .filter((p) => !served.has(p.id))
      .map((p) => reelsById.get(p.id) ?? p);
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

  // The real work — dispatched into the movement equation and, remotely,
  // sent to the server. Only ever called once a vote's grace window elapses.
  const commitVote = useCallback(
    async (contentId: string, power: VotePower) => {
      const content = contentById[contentId];
      if (!content) return;

      if (!remote) {
        dispatch({ type: "vote", contentId, power, scores: content.scores });
        return;
      }

      const t = await token();
      if (!t) return;
      dispatch({ type: "vote", contentId, power, scores: content.scores });
      try {
        const res = await callWithRetry(t, (tok) => api.vote(tok, contentId, power));
        if (res) {
          setServerPositions(res.positions);
          setServerVoteCount(res.voteCount);
          // The vote response carries this content's fresh tallies straight
          // from the DB — patch it in now rather than waiting on the next
          // full refresh(), so "how everyone voted" includes your own vote.
          const globalSplit = toSplit(res.tallies);
          setServerContent((prev) => {
            if (!prev) return prev;
            const patch = (list: Content[]) =>
              list.some((c) => c.id === contentId)
                ? list.map((c) => (c.id === contentId ? { ...c, globalSplit } : c))
                : list;
            return { reels: patch(prev.reels), posts: patch(prev.posts) };
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "vote failed");
      }
    },
    [contentById, remote, token, callWithRetry],
  );

  const clearPendingTimer = useCallback((contentId: string) => {
    const timer = pendingTimers.current[contentId];
    if (timer) {
      clearTimeout(timer);
      delete pendingTimers.current[contentId];
    }
  }, []);

  const vote = useCallback(
    (contentId: string, power: VotePower) => {
      const existingPending = pending[contentId];

      // Once a vote has committed it is final — the grace window is the only
      // chance to change it. The buttons are already inert; this is the guard.
      if (existingPending === undefined && state.reactions[contentId] !== undefined) return;

      const dir = Math.sign(power);
      const isLightTap = Math.abs(power) === 1;
      const pendingSameDir = existingPending !== undefined && Math.sign(existingPending.power) === dir;

      // A light tap toward a direction already reacted to — pending or
      // already committed — either cancels the still-open window, or is a
      // no-op: a committed vote can't be undone, and resubmitting the exact
      // same reaction would only reshuffle its place in the decay-weighted
      // history for no real change.
      if (isLightTap && pendingSameDir) {
        clearPendingTimer(contentId);
        setPending((p) => {
          const next = { ...p };
          delete next[contentId];
          return next;
        });
        return;
      }
      // A new reaction, an escalation (Like → Love), or replacing a
      // different pending direction — (re)start the grace window.
      clearPendingTimer(contentId);
      const commitAt = Date.now() + VOTE_GRACE_MS;
      setPending((p) => ({ ...p, [contentId]: { power, commitAt } }));
      pendingTimers.current[contentId] = setTimeout(() => {
        delete pendingTimers.current[contentId];
        setPending((p) => {
          const next = { ...p };
          delete next[contentId];
          return next;
        });
        void commitVote(contentId, power);
      }, VOTE_GRACE_MS);
    },
    [pending, state.reactions, clearPendingTimer, commitVote],
  );

  const toggleFollow = useCallback(
    async (personId: string) => {
      const next = !state.follows[personId];
      dispatch({ type: "setFollow", personId, following: next });
      if (!remote) return;
      const t = await token();
      if (!t) return;
      try {
        await callWithRetry(t, (tok) => api.follow(tok, personId, next));
      } catch {
        dispatch({ type: "setFollow", personId, following: !next });
      }
    },
    [remote, state.follows, token, callWithRetry],
  );

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      dispatch({ type: "profile", patch });
      if (!remote) return;
      const t = await token();
      if (!t) return;
      try {
        await callWithRetry(t, (tok) =>
          api.updateMe(tok, {
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
            ...(patch.pronouns !== undefined ? { pronouns: patch.pronouns } : {}),
            ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
            ...(patch.city !== undefined ? { city: patch.city } : {}),
            ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
            ...(patch.tier !== undefined ? { privacyTier: patch.tier } : {}),
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not save your profile");
      }
    },
    [remote, token, callWithRetry],
  );

  const saveAvatar = useCallback(
    async (fileUri: string, mediaType: string) => {
      if (!remote) {
        // Offline there is nowhere to upload to, so the local file URI stands in
        // (same fallback `publish` uses for offline post media).
        await saveProfile({ avatarUrl: fileUri });
        return;
      }
      const t = await token();
      if (!t) throw new Error("not signed in");
      const ticket = await callWithRetry(t, (tok) => api.uploadTicket(tok, mediaType));
      if (!ticket) throw new Error("not signed in");
      await uploadToSignedUrl(ticket.uploadUrl, fileUri, mediaType);
      await saveProfile({ avatarUrl: ticket.publicUrl });
    },
    [remote, token, callWithRetry, saveProfile],
  );

  const completeOnboarding = useCallback(
    async (input: { handle: string; bio: string; birthday: string }) => {
      await saveProfile({ handle: input.handle, bio: input.bio });
      dispatch({ type: "onboard", birthday: input.birthday });
      // Not routed through saveProfile: `onboarded` isn't a Profile field
      // (it's not something Settings ever lets you edit back and forth) —
      // this is the one place it's ever set, and it needs to reach the
      // server so it outlives this device (see the "onboardedFromServer"
      // reducer case and its comment for why that matters).
      if (remote) {
        const t = await token();
        if (t) {
          try {
            await callWithRetry(t, (tok) => api.updateMe(tok, { onboarded: true }));
          } catch {
            // The local flag above already unblocked this session; a failed
            // sync here just means refresh() will need to try again later
            // rather than someone being stuck re-onboarding right now.
          }
        }
      }
    },
    [saveProfile, remote, token, callWithRetry],
  );

  const forgetMe = useCallback(async () => {
    if (remote) {
      const t = await token();
      if (t) {
        try {
          await callWithRetry(t, (tok) => api.forgetMe(tok));
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
  }, [remote, token, callWithRetry]);

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

      const ticket = await callWithRetry(t, (tok) => api.uploadTicket(tok, input.mediaType));
      if (!ticket) throw new Error("not signed in");
      await uploadToSignedUrl(ticket.uploadUrl, input.fileUri, input.mediaType);
      const row = await callWithRetry(t, (tok) =>
        api.createContent(tok, {
          type: input.type,
          body: input.body,
          categories: input.categories,
          mediaPath: ticket.path,
          mediaType: input.mediaType,
        }),
      );
      if (!row) throw new Error("not signed in");
      dispatch({ type: "post", content: toContent(row) });
    },
    [positions, remote, token, callWithRetry],
  );

  const unlocked = voteCount >= UNLOCK_AT;
  // Black and white until a real color is actually earned — no placeholder
  // hue standing in for the Mind-grid color before then.
  const accent = unlocked ? nearestPoint("mind", positions.mind).hex! : c.text;

  const value = useMemo<Store>(
    () => ({
      mode,
      myId,
      hydrated,
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
      // A solid, opaque tint — not a translucent overlay — so a filled chip or
      // pill reads the same regardless of what's ever been drawn behind it.
      accentSoft: mixHex(accent, c.app, 0.22),
      reels,
      posts,
      people,
      peopleById,
      contentById,
      vote,
      toggleFollow,
      saveProfile,
      saveAvatar,
      forgetMe,
      publish,
      completeOnboarding,
      // Remotely the server's number wins: a private person's coordinates are
      // withheld, so recomputing here would be wrong.
      alignmentWith: (person) => alignments[person.id] ?? totalAlignment(positions, person.positions),
      reactionOf: (contentId) => pending[contentId]?.power ?? state.reactions[contentId],
      pendingUntilOf: (contentId) => pending[contentId]?.commitAt,
      isVoteLocked: (contentId) =>
        state.reactions[contentId] !== undefined && pending[contentId] === undefined,
      isFollowing: (personId) => Boolean(state.follows[personId]),
      clearStorage: () => {
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      },
    }),
    [
      mode, myId, hydrated, loading, error, refresh, state, positions, voteCount, unlocked, accent,
      reels, posts, people, peopleById, contentById, vote, toggleFollow, saveProfile, saveAvatar, forgetMe, publish, completeOnboarding,
      alignments, pending,
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
