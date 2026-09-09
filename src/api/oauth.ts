import type { Session } from "./client";

/**
 * Supabase's OAuth redirect carries the session in the URL fragment:
 *   pnyx://auth-callback#access_token=…&refresh_token=…&expires_in=3600
 * Errors come back the same way, as error / error_description.
 */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Minimal base64url decode — Hermes has no reliable global atob. */
function decodeBase64Url(input: string): string {
  const clean = input.replace(/-/g, "+").replace(/_/g, "/");
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v === -1) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
    }
  }
  return out;
}

/** The `sub` claim, i.e. the Supabase user id. Not verified — the server does that. */
function subjectOf(accessToken: string): string {
  const [, payload] = accessToken.split(".");
  if (!payload) return "";
  try {
    return String(JSON.parse(decodeBase64Url(payload)).sub ?? "");
  } catch {
    return "";
  }
}

export class OAuthError extends Error {}

export function sessionFromRedirect(url: string): Session {
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1).split("#")[0] : "";
  const params = new URLSearchParams(hash || query);

  const error = params.get("error_description") ?? params.get("error");
  if (error) throw new OAuthError(decodeURIComponent(error.replace(/\+/g, " ")));

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new OAuthError("Google sign-in did not return a session");
  }

  const expiresIn = Number(params.get("expires_in") ?? 3600);
  return {
    accessToken,
    refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
    userId: subjectOf(accessToken),
  };
}
