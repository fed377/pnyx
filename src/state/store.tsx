import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { identifyUser, resetAnalyticsUser, track, VOTE_TYPE_LABEL } from "@/analytics/analytics";
import { api, ApiError, uploadToSignedUrl } from "@/api/client";
import { toContent, toPerson, toSplit } from "@/api/adapters";
import { computePositions, totalAlignment, UNLOCK_AT, VOTE_GRACE_MS } from "@/lib/algorithm";
import { ALL_CONTENT, ME_DEFAULTS, ME_ID, PEOPLE, POSTS, REELS } from "@/lib/data";
import { GRID_IDS, nearestPoint } from "@/lib/grids";
import type { Content, GridId, Person, Positions, PrivacyTier, Vote, VotePower } from "@/lib/types";
import { c, mixHex } from "@/theme/tokens";
import { useSession } from "./session";

const STORAGE_KEY = "pnyx.state.v1";

/** Analytics checkpoints below the full unlock (see fireUnlockMilestones). */
const UNLOCK_MILESTONES = [10, 25, 40];

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
  /** Local-only in offline/demo mode — real enforcement (feed filtering,
   * messaging) is server-side and only meaningful once signed in. */
  blocked: Record<string, boolean>;
  gridPublic: Record<GridId, boolean>;
  /** Local notification preferences — nothing actually delivers push notifications
   * yet, but the toggles themselves are real, persisted state. */
  notifPrefs: { votes: boolean; replies: boolean; alignments: boolean };
  myPosts: Content[];
  premium: boolean;
  /** Minimum alignment % for the filter used across Home and People. */
  alignmentFilter: number;
  /** Chose "Explore without an account" on the sign-in screen — skips back to
   * it on the next "forget"/log-out instead of leaving the gate permanently open. */
  skipped: boolean;
};

const initialFollows = Object.fromEntries(PEOPLE.map((p) => [p.id, p.following]));

const initialState: State = {
  profile: { ...ME_DEFAULTS, tier: "active" },
  votes: [],
  reactions: {},
  follows: initialFollows,
  blocked: {},
  gridPublic: { values: true, mind: true, soul: true, culture: false, focus: true },
  notifPrefs: { votes: true, replies: true, alignments: false },
  myPosts: [],
  premium: false,
  alignmentFilter: 0,
  skipped: false,
};

type Action =
  | { type: "hydrate"; state: State }
  | { type: "vote"; contentId: string; power: VotePower; scores: Content["scores"] }
  | { type: "serverVotes"; votes: Vote[] }
  | { type: "toggleFollow"; personId: string }
  | { type: "setFollow"; personId: string; following: boolean }
  | { type: "setBlock"; personId: string; blocked: boolean }
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "gridPublic"; grid: GridId; value: boolean }
  /** Whole-object replace, not a per-key patch — `saveNotifPrefs()` merges
   * before dispatching, since the server (like `gridPublic`) wants the full
   * object either way and `refresh()` needs to replace it wholesale too. */
  | { type: "notifPrefs"; value: State["notifPrefs"] }
  | { type: "filter"; value: number }
  /** No self-serve purchase flow exists yet — dispatched only from `refresh()`,
   * syncing the account's real (admin/DB-set) `profiles.premium` column. There
   * is no UI path that dispatches this with a locally-chosen value. */
  | { type: "premium"; value: boolean }
  | { type: "post"; content: Content }
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
    case "setBlock":
      return { ...state, blocked: { ...state.blocked, [action.personId]: action.blocked } };
    case "profile":
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case "gridPublic":
      return { ...state, gridPublic: { ...state.gridPublic, [action.grid]: action.value } };
    case "notifPrefs":
      return { ...state, notifPrefs: action.value };
    case "filter":
      return { ...state, alignmentFilter: action.value };
    case "premium":
      return { ...state, premium: action.value };
    case "post":
      return { ...state, myPosts: [action.content, ...state.myPosts] };
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
  /** False until the persisted store has been read back. */
  hydrated: boolean;
  /** Remote mode only: false until a real GET /me has landed for *this*
   * session — see its own declaration in StoreProvider for why AuthGate
   * needs this specifically. */
  profileLoaded: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Remote mode only: `people` is capped to the top 25 by alignment (spec
   * §6.3's world list), so searching it client-side could never surface
   * someone outside that set. Queries the real user base instead and merges
   * whatever it finds into `people`/`peopleById`. A no-op locally — the
   * offline sample set already *is* the whole population.
   */
  searchPeople: (query: string) => Promise<void>;

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
  vote: (contentId: string, power: VotePower, meta?: { reelIndex?: number; viewedAt?: number }) => void;
  /** Local +1 to a content's own commentCount, for immediate feedback right
   * after a comment actually posts — see the function's own comment. */
  bumpCommentCount: (contentId: string) => void;
  toggleFollow: (personId: string) => Promise<void>;
  /** Also unfollows both directions server-side (see PnyxService.setBlock).
   * No-op in local/offline mode beyond the button's own state — there's no
   * real backend to enforce it against there anyway. */
  toggleBlock: (personId: string) => Promise<void>;
  /** Fire-and-forget — no admin surface reads these back yet (see
   * MISSING_FEATURES.md), so there's nothing for the UI to reflect beyond a
   * one-time confirmation. No-op in local/offline mode. */
  reportContent: (contentId: string, reason: string) => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  saveNotifPrefs: (patch: Partial<State["notifPrefs"]>) => Promise<void>;
  /** Uploads a picked photo (through the same signed-URL flow post media
   * uses) and saves it as the profile's avatar. */
  saveAvatar: (fileUri: string, mediaType: string) => Promise<void>;
  forgetMe: () => Promise<void>;
  publish: (input: PublishInput) => Promise<void>;
  /** Backgrounded: starts the upload/create and returns immediately, tracked
   * via postStatus/postError instead of a promise the caller awaits. */
  submitPost: (input: PublishInput) => void;
  postStatus: "idle" | "uploading" | "posted" | "failed";
  postError: string | null;
  dismissPostStatus: () => void;

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
  isBlocked: (personId: string) => boolean;
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

  // Only a real signed-in account gets identified (as a hash — see
  // identifyUser's own comment); local/offline mode's ME_ID is a sample
  // profile, not a real account, so it stays on PostHog's anonymous id.
  useEffect(() => {
    if (remote) void identifyUser(myId);
    else resetAnalyticsUser();
  }, [remote, myId]);

  // Server-owned slices, only populated in remote mode.
  const [serverPositions, setServerPositions] = useState<Positions | null>(null);
  const [serverVoteCount, setServerVoteCount] = useState(0);
  const [serverContent, setServerContent] = useState<{ reels: Content[]; posts: Content[] } | null>(null);
  const [serverPeople, setServerPeople] = useState<Person[] | null>(null);
  const [alignments, setAlignments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  // True once a real GET /me response has landed for the current session.
  // `state.profile` always holds *something* — the local sample persona by
  // default — regardless of mode, so screens that read it directly (Settings,
  // Profile) would otherwise flash that stale/default data for however long
  // refresh() takes after a fresh sign-in (a cold Render instance can take
  // tens of seconds), including the *previous* account's data if it hasn't
  // been cleared yet. AuthGate covers the app while this is false.
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Posting runs in the background now — Contribute navigates back the
  // instant you tap Post instead of blocking on the upload, so this is what
  // the persistent bottom snackbar (PostStatusSnackbar) reads to show
  // progress on whatever screen you land back on.
  const [postStatus, setPostStatus] = useState<"idle" | "uploading" | "posted" | "failed">("idle");
  const [postError, setPostError] = useState<string | null>(null);

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
        // 50 (the route's own cap) rather than just the free-tier's display limit —
        // premium unlocks more of "Most aligned in the world" (spec §6.3) by
        // showing more of what's already fetched, not by fetching more on demand.
        Promise.all([api.me(tok), api.myVotes(tok), api.reels(tok, 40), api.home(tok, 40), api.people(tok, 50)]),
      );
      if (!result) return;
      const [me, votes, reels, home, people] = result;

      setServerPositions(me.positions);
      setServerVoteCount(me.voteCount);
      // Real account fact, not a self-serve toggle — see the "premium" action's
      // own comment. Nothing sets this except a direct DB edit right now.
      dispatch({ type: "premium", value: me.premium });
      // Always present on your own /me (the server only strips it from
      // someone else's profile) — but guard anyway rather than trust that.
      if (me.notifPrefs) dispatch({ type: "notifPrefs", value: me.notifPrefs });
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
      setProfileLoaded(true);
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
      // Let AuthGate's cover clear even on failure — SyncBanner already
      // exists to surface `error` with a retry button; getting stuck behind
      // a blank cover forever would hide that instead of falling back to it.
      setProfileLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [remote, token, callWithRetry]);

  const searchPeople = useCallback(
    async (query: string) => {
      if (!remote || !query.trim()) return;
      const t = await token();
      if (!t) return;
      const result = await api.people(t, 50, query.trim());
      setServerPeople((prev) => {
        const byId = new Map((prev ?? []).map((p) => [p.id, p]));
        for (const row of result.items) byId.set(row.profile.id, toPerson(row));
        return [...byId.values()];
      });
      setAlignments((prev) => ({
        ...prev,
        ...Object.fromEntries(result.items.map((p) => [p.profile.id, p.total])),
      }));
    },
    [remote, token],
  );

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
      setProfileLoaded(false);
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
  // Only fired from here (once a vote actually commits, not on a pending
  // tap), and only from the count that was true right before this specific
  // vote — never from a passive refresh() — so an already-unlocked account
  // doesn't refire "identity_unlocked" every time it reloads.
  const fireUnlockMilestones = useCallback((before: number, after: number) => {
    for (const m of UNLOCK_MILESTONES) {
      if (before < m && after >= m) track("unlock_progress", { votes: m });
    }
    if (before < UNLOCK_AT && after >= UNLOCK_AT) track("identity_unlocked");
  }, []);

  const commitVote = useCallback(
    async (contentId: string, power: VotePower) => {
      const content = contentById[contentId];
      if (!content) return;

      if (!remote) {
        const before = state.votes.length;
        dispatch({ type: "vote", contentId, power, scores: content.scores });
        fireUnlockMilestones(before, before + 1);
        return;
      }

      const t = await token();
      if (!t) return;
      dispatch({ type: "vote", contentId, power, scores: content.scores });
      try {
        const res = await callWithRetry(t, (tok) => api.vote(tok, contentId, power));
        if (res) {
          fireUnlockMilestones(serverVoteCount, res.voteCount);
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
    [contentById, remote, token, callWithRetry, state.votes.length, serverVoteCount, fireUnlockMilestones],
  );

  /** Optimistic +1, called once a comment has actually posted (the network
   * call itself happens in useComments) — otherwise the post/reel action row
   * kept showing a stale count until the next full refresh(), even in the
   * same session. Remote only: local mode's REELS/POSTS are static, and its
   * own useComments already tracks newly-added comments separately. */
  const bumpCommentCount = useCallback((contentId: string) => {
    setServerContent((prev) => {
      if (!prev) return prev;
      const patch = (list: Content[]) =>
        list.some((c) => c.id === contentId)
          ? list.map((c) => (c.id === contentId ? { ...c, commentCount: c.commentCount + 1 } : c))
          : list;
      return { reels: patch(prev.reels), posts: patch(prev.posts) };
    });
  }, []);

  const clearPendingTimer = useCallback((contentId: string) => {
    const timer = pendingTimers.current[contentId];
    if (timer) {
      clearTimeout(timer);
      delete pendingTimers.current[contentId];
    }
  }, []);

  const vote = useCallback(
    (contentId: string, power: VotePower, meta?: { reelIndex?: number; viewedAt?: number }) => {
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
      // Tracked here at the moment of the tap (intent), not on commit —
      // reel_index/time_to_vote only exist as UI-side context at tap time.
      track("vote_cast", {
        type: VOTE_TYPE_LABEL[power],
        reel_index: meta?.reelIndex ?? null,
        time_to_vote: meta?.viewedAt !== undefined ? Date.now() - meta.viewedAt : null,
      });
      if (voteCount === 0) track("first_vote_cast");
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
    [pending, state.reactions, clearPendingTimer, commitVote, voteCount],
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

  const toggleBlock = useCallback(
    async (personId: string) => {
      const next = !state.blocked[personId];
      dispatch({ type: "setBlock", personId, blocked: next });
      // Blocking implies unfollowing both directions server-side (see
      // PnyxService.setBlock) — mirror it locally too, so the button state
      // this device already shows doesn't contradict what the server just did.
      if (next) {
        dispatch({ type: "setFollow", personId, following: false });
      }
      if (!remote) return;
      const t = await token();
      if (!t) return;
      try {
        await callWithRetry(t, (tok) => api.block(tok, personId, next));
      } catch {
        dispatch({ type: "setBlock", personId, blocked: !next });
      }
    },
    [remote, state.blocked, token, callWithRetry],
  );

  const reportContent = useCallback(
    async (contentId: string, reason: string) => {
      if (!remote) return;
      const t = await token();
      if (!t) return;
      await callWithRetry(t, (tok) => api.reportContent(tok, contentId, reason));
    },
    [remote, token, callWithRetry],
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

  const saveNotifPrefs = useCallback(
    async (patch: Partial<State["notifPrefs"]>) => {
      const next = { ...state.notifPrefs, ...patch };
      dispatch({ type: "notifPrefs", value: next });
      if (!remote) return;
      const t = await token();
      if (!t) return;
      try {
        await callWithRetry(t, (tok) => api.updateMe(tok, { notifPrefs: next }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not save your notification preferences");
      }
    },
    [remote, state.notifPrefs, token, callWithRetry],
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
            commentCount: 0,
            globalSplit: { love: 0, like: 0, dislike: 0, hate: 0 },
          },
        });
        track("post_created");
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
      track("post_created");
    },
    [positions, remote, token, callWithRetry],
  );

  // Fire-and-forget wrapper: the caller (Contribute) navigates away
  // immediately rather than awaiting this — status is tracked here instead
  // of on that now-unmounted screen, so PostStatusSnackbar can show it from
  // wherever you land back on.
  const submitPost = useCallback(
    (input: PublishInput) => {
      setPostStatus("uploading");
      setPostError(null);
      publish(input)
        .then(() => setPostStatus("posted"))
        .catch((e) => {
          setPostStatus("failed");
          setPostError(e instanceof Error ? e.message : "Could not post that");
        });
    },
    [publish],
  );

  const dismissPostStatus = useCallback(() => {
    setPostStatus("idle");
    setPostError(null);
  }, []);

  const unlocked = voteCount >= UNLOCK_AT;
  // Black and white until a real color is actually earned — no placeholder
  // hue standing in for the Mind-grid color before then.
  const accent = unlocked ? nearestPoint("mind", positions.mind).hex! : c.text;

  const value = useMemo<Store>(
    () => ({
      mode,
      myId,
      hydrated,
      profileLoaded,
      loading,
      error,
      refresh,
      searchPeople,
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
      bumpCommentCount,
      toggleFollow,
      toggleBlock,
      reportContent,
      saveProfile,
      saveNotifPrefs,
      saveAvatar,
      forgetMe,
      publish,
      submitPost,
      postStatus,
      postError,
      dismissPostStatus,
      // Remotely the server's number wins: a private person's coordinates are
      // withheld, so recomputing here would be wrong.
      alignmentWith: (person) => alignments[person.id] ?? totalAlignment(positions, person.positions),
      reactionOf: (contentId) => pending[contentId]?.power ?? state.reactions[contentId],
      pendingUntilOf: (contentId) => pending[contentId]?.commitAt,
      isVoteLocked: (contentId) =>
        state.reactions[contentId] !== undefined && pending[contentId] === undefined,
      isFollowing: (personId) => Boolean(state.follows[personId]),
      isBlocked: (personId) => Boolean(state.blocked[personId]),
      clearStorage: () => {
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      },
    }),
    [
      mode, myId, hydrated, profileLoaded, loading, error, refresh, searchPeople, state, positions, voteCount, unlocked, accent,
      reels, posts, people, peopleById, contentById, vote, bumpCommentCount, toggleFollow, toggleBlock, reportContent, saveProfile, saveNotifPrefs, saveAvatar, forgetMe, publish, submitPost, postStatus, postError, dismissPostStatus,
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
