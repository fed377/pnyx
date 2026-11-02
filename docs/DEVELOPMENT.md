# Development guide

Everything needed to run, configure and build the PNYX app. For an overview of what the app
is and how it's put together, see the [README](../README.md).

## Running the app

```bash
npm install
cp .env.example .env
npx expo start          # press i / a, or scan the QR code with Expo Go
```

> `npm expo start` is not a command (npm has no `expo` subcommand). Use `npm start` or
> `npx expo start`.

Changing `.env` needs a cache-cleared restart (`npx expo start --clear`), because
`EXPO_PUBLIC_*` values are inlined at bundle time.

### Expo Go vs. a development build

Expo Go is fine for most work. It can't load native modules it doesn't ship with, so these
need a development build:

- native Google sign-in (the system account picker; the browser flow works in Expo Go)
- push notifications (`expo-notifications` remote push was removed from Expo Go in SDK 53)

```bash
npx eas build --profile development --platform ios     # or android
npx expo run:ios                                        # local build, needs macOS + Xcode
npx expo run:android                                    # local build, needs Android Studio
```

The iOS App Store version of Expo Go only supports the latest SDK. If the project and Expo Go
disagree, Expo Go closes on launch before downloading the bundle.

### On a physical Android device

The phone's `127.0.0.1` is the phone, not your PC. Over USB, forward both ports:

```bash
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:4000 tcp:4000   # the API
```

Otherwise use your machine's LAN address (`http://192.168.x.x:4000`) and make sure the
firewall allows it. If the phone can't reach the PC at all, `npx expo start --tunnel` works
from any network.

## Backend modes

The app runs in one of two modes, decided by `EXPO_PUBLIC_API_URL` in `.env`:

- **Set**: the app requires sign-in, and every feed, profile, alignment and vote goes
  through the PNYX API, which owns the algorithm and the database.
- **Blank**: a development-only offline mode against built-in sample data, with the movement
  equation computed on-device. There is nothing to sign in to, so the sign-in screen is
  skipped. The test suite runs this way.

Every screen reads through `useStore()` without knowing which mode is active.
`src/api/adapters.ts` maps server rows onto the shapes the screens expect. In remote mode,
positions always come from the server; the client never asserts its own.

`src/state/session.tsx` keeps tokens in `expo-secure-store` and refreshes them a minute
before expiry, collapsing concurrent refreshes into a single request.

### Posting media

```
app ──> POST /content/upload-url ──> signed URL from Supabase Storage
app ──> PUT the file bytes straight to storage (never through the API)
app ──> POST /content { mediaPath, mediaType, … }
```

The server checks that the object exists and that its path sits under the caller's own prefix
before attaching it to a post. The post is then scored and moderated by the content scorer
before it is published.

## Sign in with Google

The browser-based flow needs Google enabled as a Supabase provider. Until it is, the button
opens Supabase and shows `provider is not enabled`.

**1. Google Cloud** (console.cloud.google.com → APIs & Services → Credentials)

- Configure the OAuth consent screen. External is fine while testing; add yourself as a test
  user so you don't need verification.
- Create an OAuth client ID of type **Web application**.
- Under *Authorised redirect URIs*, add your Supabase callback:
  `https://<project-ref>.supabase.co/auth/v1/callback`
- Copy the client ID and client secret.

**2. Supabase** (Dashboard → Authentication)

- *Providers → Google*: enable it, paste the client ID and secret, save.
- *URL Configuration → Redirect URLs*: add the **API's own bridge page**,
  `https://<your-api-host>/auth/mobile-redirect`, not the app's deep link. Supabase's
  `redirect_to` validation proved unreliable for custom schemes (`exp://`, `pnyx://`) even
  when allowlisted; it silently fell back to the Site URL. So the API sends Supabase back to
  this same-origin https page, and the page forwards to the real deep link. The deep link is
  checked against an allowlist on both the server and the page, so this can't become an open
  redirect. If you skip this step, Google sign-in succeeds but the app never receives the
  session.

**3. Nothing to change in the app.** The API hands it the authorize URL, so there's still no
Supabase key in the client.

The flow is: the app asks the API for the URL, `expo-web-browser` opens it, then Google,
Supabase, the bridge page, and finally a deep link back with the tokens in the URL fragment.
`src/api/oauth.ts` parses those into a session.

### Native account picker (development build only)

`signInWithGoogle()` tries the native picker (`@react-native-google-signin`) first and falls
back to the browser flow if it isn't configured.

1. **Google Cloud**: create two more OAuth client IDs on the same Credentials page.
   - Type **iOS**, bundle ID `com.villari.pnyx`. Paste its **iOS URL scheme** (the reversed
     client ID) into the `@react-native-google-signin/google-signin` plugin config in
     `app.json`.
   - Type **Android**, package `com.villari.pnyx`, with the SHA-1 of your build's signing key
     (`./gradlew signingReport` after `npx expo prebuild`, or from EAS credentials).
2. **`.env`**: set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the **Web application** client ID
   from above. That ID is the audience Supabase's `signInWithIdToken` checks, so reuse it and
   don't create a third client. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to the iOS client ID.
3. Rebuild the development client. A native module can't be picked up by Metro alone.

The app sends the Google ID token to `POST /auth/google/token`, which calls Supabase's
`signInWithIdToken`.

## Analytics

Event tracking goes through [PostHog](https://posthog.com). `src/analytics/analytics.ts` is
the only file that touches the PostHog SDK; everything else calls its `track(event, props)`.
Autocapture and session replay are both off. Only the explicit events below are sent, and
never any post or message content.

To turn it on, set `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` in `.env` (the
host is usually `https://us.i.posthog.com` or `https://eu.i.posthog.com`), then restart with
`--clear`. Leave the key blank and every call becomes a no-op.

| Area | Events |
|---|---|
| Onboarding | `app_open`, `signup_completed`, `first_vote_cast` |
| Core loop | `reel_viewed`, `vote_cast`, `reel_skipped` |
| Unlock | `unlock_progress` (10/25/40 votes), `identity_unlocked`, `identity_viewed` |
| Retention | `session_start`, `session_end` |
| Social | `profile_viewed`, `alignment_filter_used`, `post_created`, `hot_take_posted`, `message_sent` |

Once signed in, events carry a one-way SHA-256 hash of the user id (`identifyUser()`), never
the raw id. Signed-out sessions use PostHog's anonymous id.

## Design notes

- **Press-and-hold voting** uses `onPressIn`/`onPressOut` to drive a 1.5-second timing
  animation. The ring around the button is an animated `strokeDashoffset`. Finishing the hold
  commits the strong vote (±2); releasing early commits the light one (±1). Dragging off the
  button cancels.
- **Votes are optimistic and cancellable.** A vote shows immediately and sits pending for a
  short grace window (`VOTE_GRACE_MS`) before it commits. Tapping the same direction again
  cancels it. Once committed, a vote is final.
- **Double-tap to like** only ever adds a light like. A post that's already liked just replays
  the animation, because a second light tap on a pending vote means "cancel" in the store.
- **Reels** are a `FlatList` using native paging, with one reel rendered up front and only the
  reel on screen playing. Reels are memoized so a page change re-renders only the two whose
  playing state flips.
- **The Culture grid** has a labelling inconsistency in the source spec: no single axis
  orientation satisfies all four quadrant rows. The resolution (Broad at −x, Niche at +x) is
  documented at the top of `src/lib/grids.ts`.

## Testing

```bash
npm test                # Jest
npx jest <path>         # a single file
npx tsc --noEmit
npm run lint
```

`__tests__/smoke.test.tsx` mounts the real route tree with `renderRouter` from
`expo-router/testing-library`. Two things to know when adding tests:

- `render` in `@testing-library/react-native` v14 returns a Promise, so `await` the
  `renderRouter(...)` call before touching `screen`.
- Jest resolves modules through Reanimated's own resolver
  (`react-native-reanimated/jest/resolver.js`). Without it, Reanimated 4.7's mock loads the
  native initializer and every screen test fails on import.
