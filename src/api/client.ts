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

export type ApiVoteResult = {
  positions: Positions;
  voteCount: number;
  unlocked: boolean;
  unlockIn: number;
  replaced: VotePower | null;
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
    const message =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `request failed (${res.status})`;
    throw new ApiError(res.status, message);
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

  /** Supabase's Google authorize URL, for the app to open in a browser. */
  googleUrl: (redirect: string) =>
    request<{ url: string }>(`/auth/google/url?redirect=${encodeURIComponent(redirect)}`),

  refresh: (refreshToken: string) =>
    request<Session>("/auth/refresh", { method: "POST", body: { refreshToken } }),

  me: (token: string) => request<ApiMe>("/me", { token }),

  updateMe: (token: string, patch: Partial<Pick<ApiProfile, "name" | "handle" | "pronouns" | "bio" | "city" | "privacyTier" | "gridPublic">>) =>
    request<ApiMe>("/me", { method: "PATCH", token, body: patch }),

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
};
