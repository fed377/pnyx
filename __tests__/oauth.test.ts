import { OAuthError, sessionFromRedirect } from "@/api/oauth";

// header.payload.signature — payload decodes to { sub: "abc-123", role: "authenticated" }
const JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMtMTIzIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.sig";

describe("the Google redirect", () => {
  it("reads the session out of the URL fragment", () => {
    const session = sessionFromRedirect(
      `pnyx://auth-callback#access_token=${JWT}&refresh_token=r3fr3sh&expires_in=3600&token_type=bearer`,
    );

    expect(session.accessToken).toBe(JWT);
    expect(session.refreshToken).toBe("r3fr3sh");
    // The user id comes from the token's own `sub` claim.
    expect(session.userId).toBe("abc-123");
    // expires_in is relative; we store an absolute second-precision deadline.
    const now = Math.floor(Date.now() / 1000);
    expect(session.expiresAt!).toBeGreaterThan(now + 3500);
    expect(session.expiresAt!).toBeLessThanOrEqual(now + 3600);
  });

  it("also accepts the tokens as query parameters", () => {
    const session = sessionFromRedirect(
      `pnyx://auth-callback?access_token=${JWT}&refresh_token=r&expires_in=100`,
    );
    expect(session.userId).toBe("abc-123");
  });

  it("surfaces the provider's error instead of a blank session", () => {
    expect(() =>
      sessionFromRedirect("pnyx://auth-callback#error=access_denied&error_description=User+cancelled"),
    ).toThrow(OAuthError);

    try {
      sessionFromRedirect("pnyx://auth-callback#error=access_denied&error_description=User+cancelled");
    } catch (e) {
      expect((e as Error).message).toBe("User cancelled");
    }
  });

  it("refuses a redirect with no tokens on it", () => {
    expect(() => sessionFromRedirect("pnyx://auth-callback")).toThrow(/did not return a session/);
  });

  it("does not fall over on a token it cannot decode", () => {
    const session = sessionFromRedirect(
      "pnyx://auth-callback#access_token=not-a-jwt&refresh_token=r&expires_in=60",
    );
    expect(session.accessToken).toBe("not-a-jwt");
    expect(session.userId).toBe("");
  });
});
