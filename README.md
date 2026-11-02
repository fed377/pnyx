<div align="center">

# PNYX

**A social app where your reactions build your identity, so you never fill out a personality quiz.**

Every like, dislike, love and hate you cast moves you across five personality grids.
After 50 reactions, PNYX reveals a type you earned through real behavior, plus an
alignment score with everyone else on the app.

![Expo SDK 58](https://img.shields.io/badge/Expo_SDK-58-000020?logo=expo&logoColor=white)
![React Native 0.88](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-iOS_%7C_Android-lightgrey)

</div>

<!--
## Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" width="240" alt="Home feed" />
  <img src="docs/screenshots/feed.png" width="240" alt="Full-screen reels" />
  <img src="docs/screenshots/profile.png" width="240" alt="Profile and five grids" />
</p>
-->

## What it does

- **Swipe a feed of reels and posts, then react.** Tap for a like or dislike. Press and hold
  for 1.5 seconds for a love or hate. Double-tap to like. Each vote has a short grace window
  during which you can still take it back.
- **Watch your profile take shape.** Every piece of content is scored by an AI model on five
  grids: Values, Mind, Soul, Culture and Focus. Your votes move your position on each grid.
- **Unlock a type at 50 reactions.** You get a named type, an animal crest, an accent color
  and a shareable identity code, all computed from your votes.
- **Find people who think like you.** Alignment percentages are shown on every profile, in
  search and in messages. Each grid can be kept private.
- **Post, comment, message.** Photo and video posts, Hot Takes, comments and direct messages.
  An AI moderation check runs before any post is published.

## Engineering highlights

**Identity is derived, never submitted.** No endpoint accepts a grid position, and no
database policy lets a user write one. The backend recomputes your position by replaying your
vote history through a movement equation. That equation weighs each vote by the content's
AI-scored position, the model's confidence, the vote's strength and an exponential decay, so
only roughly your last 250 votes count. Even a modified client can't claim to be someone it
isn't.

**One algorithm, two runtimes.** The movement equation, decay, alignment and feed ranking
live in [`src/lib/`](src/lib). That folder is plain TypeScript with no React Native or Expo
imports, and a byte-identical copy runs on the server. A hash check (`npm run core:check` in
the backend) fails if the two copies ever drift, so the phone and the API always compute the
same number.

**Media never touches the API server.** The app asks for a signed upload URL, sends the photo
or video straight to Supabase Storage, and then creates the post by referencing the stored
path. The server only checks that the file exists and belongs to the user who is posting.

**Native-feeling interaction.** The app uses Reanimated and Gesture Handler throughout:
press-and-hold vote rings, pinch-to-zoom reels, and double-tap-to-like bursts. A single tap
waits out a possible second tap so the two gestures don't conflict. Liquid Glass surfaces are
used on iOS 26, with a blur fallback elsewhere. Behind the screens, an animated Skia shader
draws the backdrop and pauses itself whenever it isn't visible.

**Privacy by default.** Session tokens are stored in the platform keychain. Analytics events
carry only a one-way hash of the user id, never post or message content. "Forget me" deletes
the account server-side and signs you out.

## Tech stack

| | |
|---|---|
| **App** | Expo SDK 58 · React Native 0.88 · React 19 (React Compiler) · TypeScript · expo-router |
| **Motion & graphics** | Reanimated 4 · Gesture Handler · React Native Skia · expo-glass-effect |
| **Backend** ([separate repo](https://github.com/fed377/pnyx_backend)) | Fastify · Supabase (Postgres, Auth, Storage) · Google Gemini for content scoring and moderation |
| **Auth** | Email/password and Google sign-in, with tokens in `expo-secure-store` |
| **Quality** | Jest + expo-router testing library · strict TypeScript · ESLint · EAS Build |
| **Analytics** | PostHog with explicit events only (no autocapture, no session replay) |

## Architecture

```
  screens ──> useStore() ──> src/api/client ──> PNYX API (Fastify) ──> Supabase
                  │                                   │
                  └── src/lib  (pure TS core)  ═══════╧══ identical copy on the server
```

Screens read everything through a single `useStore()` hook. Server rows are mapped onto
screen-friendly shapes in [`src/api/adapters.ts`](src/api/adapters.ts), so no screen knows
anything about the transport.

```
src/
  app/          file-based routes: tabs (Home, Feed, Profile, People), profiles,
                messages, settings, statistics, the post composer
  components/   VoteControls, PostCard, ProfileView, LiquidGlass, LikeBurst, …
  lib/          the portable core: grids, movement equation, decay, alignment, ranking
  state/        store, session, and data hooks (comments, conversations, hot takes)
  api/          typed API client, server-to-UI adapters, OAuth helpers
  analytics/    the only module that talks to PostHog
  theme/        design tokens: color, spacing, type scale
```

## Getting started

```bash
npm install
cp .env.example .env    # set EXPO_PUBLIC_API_URL to a running PNYX API
npx expo start          # then scan the QR code with Expo Go, or press i / a
```

```bash
npm test                # route and interaction tests
npx tsc --noEmit        # type check
npm run lint
```

You need a development build for anything that depends on native modules Expo Go doesn't
ship, such as native Google sign-in and push notifications:
`npx eas build --profile development`.

Configuration, Google sign-in, analytics and on-device setup are covered in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Testing

The smoke suite mounts the real route tree with `expo-router/testing-library`. It checks that
every route renders its own content, then exercises the full vote lifecycle: the optimistic
reaction, the cancellable grace window, the commit, and the lock once a vote is final. The
backend has its own Vitest suite, about 130 tests covering the API routes, the Gemini scorer,
feed ranking, and the seeding simulation.
