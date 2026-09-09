import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, apiConfigured, type Session } from "@/api/client";
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<SignUpResult>;
  /** Opens Google in a browser and comes back through the app's deep link. */
  signInWithGoogle: () => Promise<OAuthResult>;
  signOut: () => Promise<void>;
  /** A valid access token, refreshed if it is about to expire. */
  token: () => Promise<string | null>;
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
      if (next) await AsyncStorage.setItem(KEY, JSON.stringify(next));
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // Storage unavailable — the session still works for this run.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
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

  const token = useCallback(async (): Promise<string | null> => {
    const s = current.current;
    if (!s) return null;

    const expiring = s.expiresAt !== null && s.expiresAt - SKEW <= Math.floor(Date.now() / 1000);
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
      signIn: async (email, password) => {
        await store(await api.signIn(email.trim(), password));
      },
      signUp: async (email, password, name) => {
        const res = await api.signUp(email.trim(), password, name?.trim() || undefined);
        if ("pending" in res) return { pending: true, message: res.message };
        await store(res);
        return { pending: false };
      },
      signInWithGoogle: async () => {
        // In Expo Go this is an exp:// URL; in a build it is pnyx://. Whichever
        // it is, it has to be allowlisted in Supabase's URL configuration.
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
