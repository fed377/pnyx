import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import PostHog from "posthog-react-native";
import type { PostHogEventProperties } from "@posthog/core";

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * Beta analytics — see "Analytics list for the beta" (PNYX.docx). Manual
 * events only: autocapture and session replay are both off, since the doc's
 * own "what not to log" rules out capturing raw screen/interaction content.
 * No-ops everywhere when no key is configured (EXPO_PUBLIC_POSTHOG_KEY unset)
 * — same fallback pattern EXPO_PUBLIC_API_URL uses for offline mode, so a
 * dev build with no PostHog project just quietly skips tracking.
 */
let client: PostHog | null = null;

export function initAnalytics() {
  if (!POSTHOG_KEY || client) return;
  client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    captureAppLifecycleEvents: false, // app_open/session_start/session_end are tracked explicitly below instead
    // Per "what not to log": never diff/replay actual screen content.
    enableSessionReplay: false,
  });
}

export function track(event: string, properties?: PostHogEventProperties) {
  client?.capture(event, properties);
}

/**
 * The real Supabase user id never reaches PostHog — only a one-way SHA-256
 * hash of it, truncated. That keeps the same account recognizable across
 * sessions/devices/reinstalls (needed for D1/D3/D7 retention and the
 * signup→first-vote gap) without PostHog, or anyone reading its dashboard,
 * ever holding the raw id.
 */
export async function identifyUser(realUserId: string) {
  if (!client) return;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, realUserId);
  client.identify(`u_${hash.slice(0, 24)}`);
}

/** Local/offline mode, sign-out, or "forget me" — back to an anonymous id. */
export function resetAnalyticsUser() {
  client?.reset();
}

export const VOTE_TYPE_LABEL: Record<number, string> = {
  2: "love",
  1: "like",
  [-1]: "dislike",
  [-2]: "hate",
};

/**
 * Fires `app_open` once on launch (with `source`: whether the app was opened
 * via a link or directly) and `session_start`/`session_end` around
 * foreground/background transitions, matching the doc's RETENTION section
 * ("session_start / session_end ... D1/D3/D7 returns derive from sessions").
 */
export function useAnalyticsLifecycle() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    initAnalytics();

    Linking.getInitialURL()
      .then((url) => {
        track("app_open", { source: url ? "link" : "direct" });
        track("session_start");
      })
      .catch(() => {
        track("app_open", { source: "direct" });
        track("session_start");
      });

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") track("session_start");
      else if (next === "background") track("session_end");
    });
    return () => sub.remove();
  }, []);
}
