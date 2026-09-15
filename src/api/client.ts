import type { GridId, Positions, PrivacyTier, Scores, Vote, VotePower } from "@/lib/types";

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL in .env.
 *
 * On a physical Android device the phone's localhost is the phone, not your PC,
 * so either run `adb reverse tcp:4000 tcp:4000` (USB) or point this at your
 * machine's LAN address.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
export const apiConfigured = API_URL.length > 0;

/* ── Wire types (what the backend actually returns) ─────────────────────────── */

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  userId: string;
};

export type ApiProfile = {
  id: string;
  handle: string;
  name: string;
  pronouns: string;
  bio: string;
  city: string;
  avatarUrl?: string;
  privacyTier: PrivacyTier;
  gridPublic: Record<GridId, boolean>;
  premium: boolean;
  createdAt: string;
};

export type ApiMe = ApiProfile & {
  positions: Positions | null;
  voteCount: number;
  unlocked: boolean;
  identity: unknown | null;
  alignment?: { total: number; perGrid: Partial<Record<GridId, number>> };
};

export type ApiContent = {
  id: string;
  authorId: string;
  type: "video" | "image" | "text";
  body: string;
  context?: string;
  music?: string;
  mediaUrl?: string;
  scores: Scores;
  moderationStatus: "pending" | "approved" | "rejected";
  tallies: { love: number; like: number; dislike: number; hate: number };
  createdAt: string;
};

export type ApiPerson = {
  profile: ApiProfile;
  total: number;
  voteCount: number;
  unlocked: boolean;
  following: boolean;
  follower: boolean;
  positions: Positions | null;
};

export type ApiMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body?: string;
  contentId?: string;
  voteSnapshot?: VotePower;
  createdAt: string;
};

export type ApiConversation = {
  id: string;
  otherUserId: string;
  createdAt: string;
  lastMessage: ApiMessage | null;
};

export type ApiNotification = {
  id: string;
  userId: string;
  actorId?: string;
  kind: "vote" | "follow" | "alignment" | "reply";
  body: string;
  contentId?: string;
  pct?: number;
  readAt?: string;
  createdAt: string;
};

export type ApiHotTake = {
  id: string;
  authorId: string;
  category: GridId;
  body: string;
  up: number;
  down: number;
  comments: number;
  createdAt: string;
  expiresAt: string;
};

export type ApiComment = {
  id: string;
  contentId: string;
  authorId: string;
  body: string;
  createdAt: string;
  up: number;
  down: number;
  myVote: 1 | -1 | null;
};

export type ApiVoteResult = {
  positions: Positions;
  voteCount: number;
  unlocked: boolean;
  unlockIn: number;
  replaced: VotePower | null;
  /** The content just voted on, fresh from the DB — includes this vote. */
  tallies: { love: number; like: number; dislike: number; hate: number };
};

/**
 * Sends the file bytes to the signed URL.
 *
 * Deliberately not routed through the API — a phone video should not be proxied
 * through a Node process. Note that a plain `fetch(fileUri).blob()` does NOT
 * work in React Native: RN's fetch cannot read file:// URIs. Both paths below
 * stream from disk instead.
 */
export async function uploadToSignedUrl(uploadUrl: string, fileUri: string, contentType: string) {
  const headers = { "Content-Type": contentType };

  // Preferred: the SDK 57 File API, which implements Blob and streams.
  try {
    const { fetch: expoFetch } = await import("expo/fetch");
    const { File } = await import("expo-file-system");
    const file = new File(fileUri);
    const res = await expoFetch(uploadUrl, {
      method: "PUT",
      headers,
      body: file as unknown as BodyInit,
    });
    if (!res.ok) throw new ApiError(res.status, `upload failed (${res.status})`);
    return;
  } catch (modern) {
    // Fall through to the long-standing uploader below.
    const legacyError = await uploadWithLegacy(uploadUrl, fileUri, headers).catch((e) => e);
    if (legacyError instanceof Error) {
      const first = modern instanceof Error ? modern.message : String(modern);
      throw new ApiError(0, `could not upload the file (${first}; ${legacyError.message})`);
    }
  }
}

async function uploadWithLegacy(uploadUrl: string, fileUri: string, headers: Record<string, string>) {
  const FileSystem = await import("expo-file-system/legacy");
  const res = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`storage rejected the upload (${res.status})`);
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /**
     * Extra fields the API attached to the error, e.g. a rejected post's
     * moderation outcome: `code` ("policy_violation" | "low_effort"),
     * `flagged`, `strikeCount`. Undefined for ordinary errors.
     */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Options = {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  if (!apiConfigured) throw new ApiError(0, "EXPO_PUBLIC_API_URL is not set");

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON error body; fall through with the raw text
  }

  if (!res.ok) {
    const body = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    const message = body && "error" in body ? String(body.error) : `request failed (${res.status})`;
    const { error: _error, ...details } = body ?? {};
    throw new ApiError(res.status, message, Object.keys(details).length ? details : undefined);
  }
  return parsed as T;
}

/* ── Endpoints ──────────────────────────────────────────────────────────────── */

export const api = {
  health: () => request<{ ok: boolean; unlockAt: number }>("/health"),

  signUp: (email: string, password: string, name?: string) =>
    request<Session | { pending: true; message: string }>("/auth/signup", {
      method: "POST",
      body: { email, password, ...(name ? { name } : {}) },
    }),

  signIn: (email: string, password: string) =>
    request<Session>("/auth/signin", { method: "POST", body: { email, password } }),

  /** Supabase's Google authorize URL, for the app to open in a browser — the
   * fallback path for Expo Go / web, where the native account picker isn't available. */
  googleUrl: (redirect: string) =>
    request<{ url: string }>(`/auth/google/url?redirect=${encodeURIComponent(redirect)}`),

  /** Exchanges a Google ID token from the native system account picker for a
   * session, via Supabase's signInWithIdToken — no browser round-trip. */
  googleToken: (idToken: string) =>
    request<Session>("/auth/google/token", { method: "POST", body: { idToken } }),

  refresh: (refreshToken: string) =>
    request<Session>("/auth/refresh", { method: "POST", body: { refreshToken } }),

  me: (token: string) => request<ApiMe>("/me", { token }),

  updateMe: (
    token: string,
    patch: Partial<Pick<ApiProfile, "name" | "handle" | "pronouns" | "bio" | "city" | "avatarUrl" | "privacyTier" | "gridPublic">>,
  ) => request<ApiMe>("/me", { method: "PATCH", token, body: patch }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      token,
      body: { currentPassword, newPassword },
    }),

  /** Own votes, oldest first, with score snapshots — enough to redraw history. */
  myVotes: (token: string) => request<{ items: Vote[] }>("/me/votes", { token }),

  forgetMe: (token: string) => request<void>("/me", { method: "DELETE", token }),

  reels: (token: string, limit = 30) =>
    request<{ items: ApiContent[] }>(`/feed/reels?limit=${limit}`, { token }),

  home: (token: string, limit = 40) =>
    request<{ items: ApiContent[] }>(`/home?limit=${limit}`, { token }),

  people: (token: string, limit = 25) =>
    request<{ items: ApiPerson[] }>(`/people?limit=${limit}`, { token }),

  person: (token: string, id: string) => request<ApiMe>(`/people/${id}`, { token }),

  vote: (token: string, contentId: string, power: VotePower) =>
    request<ApiVoteResult>("/votes", { method: "POST", token, body: { contentId, power } }),

  follow: (token: string, id: string, following: boolean) =>
    request<{ following: boolean }>(`/follows/${id}`, {
      method: following ? "PUT" : "DELETE",
      token,
    }),

  /** Step one: a signed URL to PUT the file straight to storage. */
  uploadTicket: (token: string, contentType: string) =>
    request<{ path: string; uploadUrl: string; publicUrl: string; kind: "image" | "video" }>(
      "/content/upload-url",
      { method: "POST", token, body: { contentType } },
    ),

  createContent: (
    token: string,
    input: {
      type: "image" | "video";
      body: string;
      categories: GridId[];
      mediaPath: string;
      mediaType: string;
    },
  ) => request<ApiContent>("/content", { method: "POST", token, body: input }),

  conversations: (token: string) => request<{ items: ApiConversation[] }>("/conversations", { token }),

  /** Opens (or starts) the 1:1 thread with `otherUserId`. */
  openConversation: (token: string, otherUserId: string) =>
    request<{ conversationId: string; otherUserId: string; messages: ApiMessage[] }>(
      `/conversations/with/${otherUserId}`,
      { token },
    ),

  messages: (token: string, conversationId: string) =>
    request<{ items: ApiMessage[] }>(`/conversations/${conversationId}/messages`, { token }),

  sendMessage: (
    token: string,
    conversationId: string,
    input: { body?: string; contentId?: string; votePower?: VotePower },
  ) => request<ApiMessage>(`/conversations/${conversationId}/messages`, { method: "POST", token, body: input }),

  notifications: (token: string, limit = 50) =>
    request<{ items: ApiNotification[] }>(`/notifications?limit=${limit}`, { token }),

  hotTakes: (token: string, limit = 30) =>
    request<{ items: ApiHotTake[] }>(`/hot-takes?limit=${limit}`, { token }),

  postHotTake: (token: string, category: GridId, body: string) =>
    request<ApiHotTake>("/hot-takes", { method: "POST", token, body: { category, body } }),

  comments: (token: string, contentId: string) =>
    request<{ items: ApiComment[] }>(`/content/${contentId}/comments`, { token }),

  addComment: (token: string, contentId: string, body: string) =>
    request<ApiComment>(`/content/${contentId}/comments`, { method: "POST", token, body: { body } }),

  voteComment: (token: string, commentId: string, power: 1 | -1) =>
    request<{ up: number; down: number; myVote: 1 | -1 | null }>(`/comments/${commentId}/vote`, {
      method: "POST",
      token,
      body: { power },
    }),
};
