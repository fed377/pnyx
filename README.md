# PNYX — native app

The iOS/Android build of PNYX. Expo SDK 57, expo-router, TypeScript.
Spec surfaces from §6, with the identity system (§3) and the algorithm (§4) running for real
against local state — every vote goes through the movement equation and moves your five grids.

```bash
cd pnyx-native          # all of these must run from this folder
npm install

npm start               # or: npx expo start
                        # then press i / a in the terminal, or scan the QR with Expo Go

npm test                # 13 route + interaction tests
npx tsc --noEmit        # type check
```

> `npm expo start` is not a command and will fail — npm has no `expo` subcommand.
> Use `npm start` (which runs the `start` script) or `npx expo start`.

To produce real binaries you need a build, not just the dev server:

```bash
npx expo run:ios        # requires macOS + Xcode
npx expo run:android    # requires Android Studio + a device/emulator
npx eas build -p all    # cloud build, no local toolchain needed
```

## Routes

```
src/app/
  _layout.tsx           root Stack + StoreProvider + ToastProvider
  (tabs)/_layout.tsx    the four-tab bar
  (tabs)/index.tsx      Home — Hot Takes, posts, alignment filter, unlock banner
  (tabs)/feed.tsx       Feed — paging full-screen reels
  (tabs)/people.tsx     People — search, filter, top ten in the world
  (tabs)/profile.tsx    Profile — your own, always 100% aligned
  u/[id].tsx            Someone else's profile; alignment ticks up on open
  settings.tsx          Account, three visibility tiers, Forget Me
  stats.tsx             Per-grid drift, past icons, rarity, premium gate
  messages/index.tsx    Conversations, each with an alignment %
  messages/[id].tsx     Thread; forwarded posts carry the sender's vote
  contribute.tsx        Speaker-gated: categories → warning → composer
  notifications.tsx     From the bell on Home
```

## Connecting to the backend

The app runs in one of two modes, decided by a single variable in `.env`:

```
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000
```

- **Set** — the app asks you to sign in, then every feed, profile, alignment and vote
  goes through `../pnyx-backend`, which owns the algorithm and the database.
- **Blank** — the app runs entirely offline against the sample people and posts, with the
  movement equation computed on-device. Useful for design work with no server running.

The sign-in screen also offers "explore the sample profile without an account", which drops
into offline mode for that session.

### On a physical Android device

The phone's `127.0.0.1` is the phone, not your PC. Over USB, forward both ports:

```bash
adb reverse tcp:8081 tcp:8081   # Metro
adb reverse tcp:4000 tcp:4000   # the API
```

Then `127.0.0.1` works as written. Otherwise use your machine's LAN address
(`http://192.168.x.x:4000`) and make sure the firewall allows it.

Changing `.env` needs a cache-cleared restart — `npx expo start --clear` — because
`EXPO_PUBLIC_*` values are inlined at bundle time.

### Sign in with Google

The button is built and wired, but Google is a provider you have to turn on — until then
tapping it opens Supabase and shows `provider is not enabled`.

**1. Google Cloud** — console.cloud.google.com → APIs & Services → Credentials

- Configure the OAuth consent screen (External is fine while testing; add yourself as a
  test user so you don't need verification).
- Create an OAuth client ID of type **Web application**.
- Under *Authorised redirect URIs* add your Supabase callback:
  `https://<project-ref>.supabase.co/auth/v1/callback`
- Copy the client ID and client secret.

**2. Supabase** — Dashboard → Authentication

- *Providers → Google*: enable it, paste the client ID and secret, save.
- *URL Configuration → Redirect URLs*: add the **API's own bridge page**, not the app's deep
  link — `https://<your-api-host>/auth/mobile-redirect`. Supabase's `redirect_to` validation
  turned out unreliable for custom app schemes (`exp://`, `pnyx://`) even when correctly
  allowlisted, silently falling back to the project's Site URL instead of erroring. So the
  API tells Supabase to come back to this same-origin https page instead, and the page's own
  inline script finishes the last hop to the real deep link client-side (`req.protocol`/
  `req.hostname`-derived, never client-supplied — see `authRoutes.ts`'s `bridgeFor`). The
  deep link itself is re-validated against an allowlist both server- and page-side, so this
  can't become an open redirect. Miss this step and Google succeeds but the app never
  receives the session.

**3. Nothing to change in the app.** The API hands it the authorize URL, so there is still
no Supabase key in the client.

The flow is: app asks the API for the URL → `expo-web-browser` opens it → Google → Supabase
→ the bridge page above → deep link back with the tokens in the URL fragment →
`src/api/oauth.ts` parses them into a session. It uses the implicit flow, which is what
Supabase returns for a plain `/authorize` request; the tokens live in a deep-link fragment,
never in a logged query string.

Note this works in Expo Go because it is browser-based. The app also has a *native* path
(`@react-native-google-signin`) — the real system account picker instead of a browser —
which `signInWithGoogle()` tries first and falls back from automatically if it isn't set up.

**Native account picker setup** (needs a custom dev build; does nothing in Expo Go):

1. **Google Cloud** — same Credentials page as above, two more OAuth client IDs:
   - Type **iOS**, bundle ID `com.anonymous.pnyx` (matches `app.json`'s `ios.bundleIdentifier`).
     Note the **iOS URL scheme** it gives you (the reversed client ID,
     `com.googleusercontent.apps.XXXX`) and paste it into `app.json`'s
     `@react-native-google-signin/google-signin` plugin config, replacing
     `REPLACE_WITH_REVERSED_IOS_CLIENT_ID`.
   - Type **Android**, package `com.anonymous.pnyx`, with the SHA-1 of your dev build's signing
     key (`cd android && ./gradlew signingReport` after `npx expo prebuild`, or from EAS's
     credentials for an EAS build).
2. **`.env`** — set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the **Web application** client ID from
   the browser-flow setup above (this is the audience Supabase's `signInWithIdToken` checks
   the token against — reuse it, don't create a third client for this), and
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to the new iOS client ID. Leave both blank to keep every
   platform on the browser flow.
3. Rebuild the dev client (`npx expo prebuild` + `npx expo run:ios` / `run:android`, or an EAS
   dev build) — a native module can't be picked up by Metro alone.

The app hands the resulting Google ID token to `POST /auth/google/token`, which calls
Supabase's `signInWithIdToken` — no redirect_to allowlist to maintain for this path.

### How it fits together

```
  screens ──> useStore() ──┬── local mode:  lib/data + computePositions on device
                           └── remote mode: src/api/client ──> PNYX API ──> Supabase
```

Every screen reads from `useStore()` and does not know which mode it is in;
`src/api/adapters.ts` maps server rows onto the shapes the screens were written against.
Positions in remote mode always come from the server — the client never asserts its own.

`src/state/session.tsx` holds the tokens in `AsyncStorage` and refreshes them a minute
before expiry, collapsing concurrent refreshes into one request.

### Posting media

Creating a post now requires a photo or video — the text-only option was removed.
`expo-image-picker` selects the file, then:

```
app ──> POST /content/upload-url ──> signed URL from Supabase Storage
app ──> PUT the file bytes straight to storage (never through the API)
app ──> POST /content { mediaPath, mediaType, … }
```

The file never passes through the Node process, which matters once people post video.
The server checks the object actually exists, and that its path sits under the caller's own
prefix, before it will attach it to a post.

`Media` renders the real file when a post has one (`expo-image` for photos, `expo-video` for
clips) and falls back to the generated composition for the seeded posts, which have none.
In the Feed only the reel actually on screen plays; the rest stay paused.

Existing text posts still render — this only removed the ability to *create* them.

Your own posts appear in both Home and the Feed, with the vote controls disabled: spec §5
forbids voting on your own posts, not seeing them. A post still awaiting moderation is shown
only to you, labelled "In review". Nothing auto-polls — pull down to refresh, and the app
re-fetches whenever it returns to the foreground.

### Served by the API in remote mode

Messages, notifications, Hot Takes and comments all have real endpoints and read live data
once signed in — none of them fall back to `lib/data` in remote mode any more.

## Layout

`src/lib/` is the portable core — the grid tables, the movement equation, decay, alignment and
the recommendation ranking. It is plain TypeScript with no React Native and no DOM in it, so it
can be lifted into a server or a second client unchanged. Keep it that way: no imports from
`react-native`, `expo-*`, or any component.

```
src/
  lib/          grids.ts, algorithm.ts, feed.ts, data.ts, format.ts, types.ts
  state/        store.tsx — votes in, positions out, persisted to AsyncStorage
  theme/        tokens.ts — colours, spacing, type scale
  components/   Crest, VoteControls, GridPlot, PostCard, ProfileView, Sheet, …
  app/          one file per route (see above)
```

## Native-specific decisions

- **Press-and-hold** is `onPressIn`/`onPressOut` driving an `Animated.timing` over 1500ms. The
  ring around the button is an animated `strokeDashoffset`; finishing the animation commits the
  strong vote (±2), releasing early commits the light one (±1). A separate 825ms timer flips the
  icon to heart/broken-heart so you can see which vote you're about to cast.
- **Reels** are a `FlatList` with `pagingEnabled` and an item height measured by `onLayout`,
  rather than CSS scroll-snap. The action rail and the caption panel live in one flex column so
  the rail can never sit underneath the results panel.
- **The accent colour** comes from your Mind position once the type unlocks at 50 reactions, and
  is passed through `useStore()` rather than a CSS variable.
- **Safe areas** are handled with `useSafeAreaInsets` in the top bars and the message composer.

## Assumptions and stand-ins

Each one needs a backend to replace it:

1. **No AI, no backend.** Content carries hand-authored `ai_scores` in place of §8's scoring job.
   Posts you write inherit your own position at 0.55 confidence.
2. **No uploaded media.** Every image and reel is a composition generated deterministically from
   that post's own grid scores. Profile pictures are monograms ringed in the person's Mind colour,
   with the personality icon overlaid as §6.2 requires.
3. **State is on-device** in `AsyncStorage` under `pnyx.state.v1`. "Forget Me" really clears it.
4. **Rarity figures** on Statistics are placeholders — genuinely so offline (there's no
   population to measure against with no backend); remote mode computes real ones server-side.
5. **Privacy tiers** on other people's profiles map to: Speaker reveals all five grids, Active
   hides Culture and Focus, Private hides all five. Not pinned down by the spec.
6. **App icons are still the Expo defaults** in `assets/images/` — they need real artwork before
   any build goes to a store.

## The Culture spec inconsistency

Documented in full at the top of `src/lib/grids.ts`: the §3.2 Culture table
labels Broad/Niche in a way no single axis orientation can satisfy. Its classical quadrants put
Niche at +x; its contemporary quadrants put Broad at +x. Two of the four rows must be wrong. This
build puts **Broad at −x, Niche at +x**, matching the classical half and the convention every
other grid follows. Coordinates, names and hex values are untouched.

## Testing

`__tests__/smoke.test.tsx` mounts the real route tree with `renderRouter` from
`expo-router/testing-library`, checks that all twelve routes render their own content, then taps
a like and asserts the vote is recorded, the global split appears, and the unlock counter drops.

Two things to know if you add tests: `render` in `@testing-library/react-native` v14 returns a
**Promise**, so `renderRouter(...)` must be awaited before touching `screen`; and `renderRouter`
switches on Jest fake timers itself.
