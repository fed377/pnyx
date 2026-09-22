import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { track } from "@/analytics/analytics";
import { api, apiConfigured, type Session } from "@/api/client";
import { signInWithGoogleNative } from "@/api/googleNative";
import { sessionFromRedirect } from "@/api/oauth";

const KEY = "pnyx.session.v1";
/** Refresh this many seconds before the token actually expires. */
const SKEW = 60;

type SignUpResult = { pending: boolean; message?: string };
type OAuthResult = { cancelled: boolean };

type SessionStore = {
  /** Null when signed out, or when running without a backend. */
  session: Session | null;
  /** False until the stored session has been read back. */
  ready: boolean;
  configured: boolean;
  /** `identifier` is an email or a handle. */
  signIn: (identifier: string, password: string) => Promise<void>;
  /** `birthday` is YYYY-MM-DD, collected on the create-account screen. */
  signUp: (
    email: string,
    password: string,
    birthday: string,
    name?: string,
    handle?: string,
  ) => Promise<SignUpResult>;
  /** Live "is this handle free" check for the create-account screen. */
  handleAvailable: (handle: string) => Promise<boolean>;
  /** The system Google account picker when a native build has one configured;
   * otherwise opens Google in a browser and comes back through the app's deep link. */
  signInWithGoogle: () => Promise<OAuthResult>;
  signOut: () => Promise<void>;
  /** False for a Google-only account — there is no password to change. */
  hasPassword: () => Promise<boolean>;
  /**
   * Re-verifies `currentPassword` server-side before setting `newPassword` —
   * except for an account with no password yet (Google-only), where there is
   * nothing to verify and `currentPassword` should be omitted.
   */
  changePassword: (currentPassword: string | undefined, newPassword: string) => Promise<void>;
  /** Emails a recovery link — `identifier` is an email or a handle, and this
   * always resolves the same way whether or not the account is actually
   * registered. The link opens `auth-callback.tsx`. */
  forgotPassword: (identifier: string) => Promise<void>;
  /**
   * The other half of that link: `redirectUrl` is the raw deep link
   * `auth-callback.tsx` was opened with. Sets the new password using the
   * recovery session it carries, then signs the user in with that same
   * session — no separate sign-in step after resetting.
   */
  completePasswordReset: (redirectUrl: string, newPassword: string) => Promise<void>;
  /**
   * A valid access token, refreshed if it is about to expire. Pass `force`
   * when a call was rejected server-side despite looking valid locally (a
   * revoked session, clock skew) — it refreshes regardless of `expiresAt`,
   * and signs the user out if the refresh token itself is dead.
   */
  token: (force?: boolean) => Promise<string | null>;
};

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  // Held in a ref too, so token() never reads a stale closure.
  const current = useRef<Session | null>(null);
  const refreshing = useRef<Promise<string | null> | null>(null);

  const store = useCallback(async (next: Session | null) => {
    current.current = next;
    setSession(next);
    try {
      if (next) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
      else await SecureStore.deleteItemAsync(KEY);
    } catch {
      // Storage unavailable — the session still works for this run.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw) as Session;
        current.current = parsed;
        setSession(parsed);
      })
      .catch(() => {
        // Unreadable session — start signed out.
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const token = useCallback(async (force = false): Promise<string | null> => {
    const s = current.current;
    if (!s) return null;

    const expiring = force || (s.expiresAt !== null && s.expiresAt - SKEW <= Math.floor(Date.now() / 1000));
    if (!expiring) return s.accessToken;

    // Collapse concurrent refreshes into one request.
    refreshing.current ??= (async () => {
      try {
        const next = await api.refresh(s.refreshToken);
        await store(next);
        return next.accessToken;
      } catch {
        await store(null); // refresh token is dead; force a re-login
        return null;
      } finally {
        refreshing.current = null;
      }
    })();
    return refreshing.current;
  }, [store]);

  const value = useMemo<SessionStore>(
    () => ({
      session,
      ready,
      configured: apiConfigured,
      signIn: async (identifier, password) => {
        await store(await api.signIn(identifier.trim(), password));
      },
      signUp: async (email, password, birthday, name, handle) => {
        const res = await api.signUp(
          email.trim(),
          password,
          birthday,
          name?.trim() || undefined,
          handle?.trim() || undefined,
        );
        track("signup_completed");
        if ("pending" in res) return { pending: true, message: res.message };
        await store(res);
        return { pending: false };
      },
      handleAvailable: async (handle) => {
        const res = await api.handleAvailable(handle.trim());
        return res.available;
      },
      signInWithGoogle: async () => {
        // Prefer the system account picker (a custom dev build only — native
        // modules don't exist in Expo Go or on web). Only "unavailable" falls
        // through to the browser flow — an explicit cancel is reported as one,
        // not silently retried through a second, different prompt.
        const native = await signInWithGoogleNative();
        if (native.status === "cancelled") return { cancelled: true };
        if (native.status === "ok") {
          await store(await api.googleToken(native.idToken));
          return { cancelled: false };
        }

        // In Expo Go this is an expo:// URL (exp:// on older Expo Go builds);
        // in a real build it is pnyx://. The API wraps this in an https://
        // bridge page before handing it to Supabase (see pnyx-backend's
        // /auth/mobile-redirect) — Supabase's redirect_to validation is
        // unreliable for custom app schemes even when allowlisted, silently
        // falling back to the project's Site URL instead of erroring.
        // openAuthSessionAsync's second argument still watches for this raw
        // deep link, not the bridge URL: that's what makes the OS intercept
        // the *final* hop the bridge page makes, regardless of how it got there.
        const redirectTo = Linking.createURL("auth-callback");
        const { url } = await api.googleUrl(redirectTo);

        const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
        if (result.type !== "success") return { cancelled: true };

        await store(sessionFromRedirect(result.url));
        return { cancelled: false };
      },
      signOut: async () => {
        await store(null);
      },
      hasPassword: async () => {
        const t = await token();
        if (!t) return false;
        const res = await api.passwordStatus(t);
        return res.hasPassword;
      },
      changePassword: async (currentPassword, newPassword) => {
        const t = await token();
        if (!t) throw new Error("not signed in");
        await api.changePassword(t, currentPassword, newPassword);
      },
      forgotPassword: async (identifier) => {
        const redirectTo = Linking.createURL("auth-callback");
        await api.forgotPassword(identifier.trim(), redirectTo);
      },
      completePasswordReset: async (redirectUrl, newPassword) => {
        // This session comes from the recovery link, not a normal sign-in —
        // sessionFromRedirect doesn't care about that distinction, it's the
        // same access/refresh token shape either way.
        const recovery = sessionFromRedirect(redirectUrl);
        await api.resetPassword(recovery.accessToken, newPassword);
        await store(recovery);
      },
      token,
    }),
    [session, ready, store, token],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionStore {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
