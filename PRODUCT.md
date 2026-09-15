# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Primary: people who want their online reactions to build a real, earned personality
profile instead of filling out a quiz — reacting (like/dislike/love/hate) to short-form
video, image, and text content. Positioned for self-discovery, dating, friendship-finding,
and networking. Go-to-market is a single bounded pilot geography (Varese, Lombardy, Italy)
before any wider rollout.

Secondary (B2B): businesses, brands, researchers, and institutions subscribing to
aggregated, anonymized geographic/demographic opinion-tendency data derived from the
consumer app's usage.

## Product Purpose

PNYX turns ordinary content reactions into a five-dimensional personality profile. Every
vote (like/dislike/love/hate) on a piece of content nudges the user's position on up to
five independent "grids" (Values, Mind, Soul, Culture, Focus), weighted by the content's
AI-assessed position, the AI's confidence, vote strength, and a decay factor that fades
older votes out of an effective ~250-vote window. Success is a profile that feels earned
through real behavior: it unlocks (at 50 reactions) a named "type," a shareable identity
code, and percentage alignment scores against other people.

## Positioning

The one mechanism a competitor could not truthfully copy without rebuilding the same
architecture: grid positions are derived, never submitted. There is no profile field,
quiz, or client-side write path for "who you are" — only a server-held, decay-weighted
replay of actual vote history computes it (no RLS write policy on `grid_positions`; only
the backend's service-role key may write that table). This is a behavioral-identity
product, not a self-reported personality quiz with a social feed attached.

## Operating Context

- Native iOS/Android app (Expo/React Native) talking to a Fastify + Supabase backend that
  owns the algorithm and the database.
- Core loop: browse Home (posts) / Feed (full-screen reels) → react (tap = like/dislike,
  1.5s hold = love/hate) → grid positions update → discover alignment with other people
  (People search, Profile, Messages headers) → optionally post (Speaker tier only,
  moderation-gated).
- Cold start: the first ~50 reels shown to a new user are deliberately broad across all
  five grids; 1 in 20 reels thereafter is deliberately "against the grain" to reduce
  filter-bubble effects.
- Go-to-market: a single bounded pilot geography (Varese, Lombardy) before expanding city
  by city.

## Capabilities and Constraints

- Five grids (Values, Mind, Soul, Culture, Focus), each a continuous `(x,y) ∈ [-1,1]²`
  position; 13 named reference points per grid drive icon/color/type-name lookups.
- Movement equation: `P[G,n] = P[G,0] + Σ (q·C·D)/10 · (r − P)` per vote; decay
  `D = 0.99^i`; effective window caps at ~250 votes.
- Type/icon stays locked until 50 total reactions.
- Privacy tiers: Speaker (the only tier that may post) / Active / Private — one change per
  [period TBD, not decided in the spec].
- Only Speaker-tier users can post; nobody can vote on their own content.
- Content is scored by AI (Gemini) across all five grids and doubles as the moderation
  gate (`ok` / `policy_violation` / `low_effort`).
- Two client modes, same UI code path: signed-in (all data through the real backend) and
  fully offline (on-device sample data, no server).
- Not yet backed by real endpoints (still sample data even when signed in): Messages,
  Notifications, Hot Takes.
- Business model: consumer app is free and ad-free; revenue is B2B aggregated-data
  subscriptions (illustrative $19/$59/$159 tiers) plus a smaller consumer premium tier
  (deeper Statistics history, more than the top-10 global alignment matches). AI cost per
  user, patent status, and the exact long-term scale target are explicitly unresolved per
  the founders' own spec — treat any pricing/cost figures as planning placeholders, not
  validated numbers.
- GDPR "Forget Me" full-account deletion is a hard requirement and is already implemented.

## Brand Commitments

- Name/wordmark: "pnyx" (lowercase, per the current Figma handoff).
- Tagline: "Everyone should know what everyone really thinks."
- Visual identity is mid-transition: a Figma "Pnyx – iOS prototype handover" file (light,
  monochrome — black/white/warm-grey chrome; colour reserved for grid data and the vote
  up/down semantics, never decoration) is being implemented to replace the app's original
  all-dark, accent-tinted theme. Treat the Figma file as the live source of truth for UI
  chrome. The per-user accent-color mechanism (derived from Mind-grid position) still
  drives grid/identity visualizations (GridPlot, Crest, Statistics) and was deliberately
  preserved during the light-theme migration — not yet confirmed or contradicted by any
  screen beyond Home.
- The five-grid identity system (names, animals, hex colors per named point) is fixed
  content from the founders' spec — not to be reinvented.

## Evidence on Hand

- `PNYX FInal Specification.md` and `PNYX Monetization Plan.md` (repo root) — the full
  founder-sourced product spec and business model, including the exact grid reference
  tables, algorithm formulas, and information architecture.
- Figma "Pnyx – iOS prototype handover" file — real Simulator-captured renders of every
  screen (light + dark variants, dynamic type, vote states); the live design source of
  truth. Only 17 of 22 frames have been pulled into `pnyx-native/figma-screenshots/` so
  far — a Figma MCP rate limit interrupted the rest.
- Seeded sample people/posts (`pnyx-native/src/lib/data.ts`) used for offline/local mode
  and demos — not real user data.
- No real user research, testimonials, or case studies on hand; do not fabricate any.

## Product Principles

1. Positions are earned, never asserted — any product decision that would let a client
   write or fake a grid position is out of bounds.
2. Two clients, one algorithm — the movement equation must produce identical output
   on-device (offline mode) and on the server; the two copies are checked for drift, not
   merged, until a shared package is worth the migration.
3. Restraint over revelation — Statistics and profile surfaces are deliberately "clean,
   not too revealing" per the founders' own brief; don't over-expose derived data.
4. Cost and legal exposure are first-class risks, not launch afterthoughts — AI scoring
   cost per post and GDPR handling of any aggregated/resold data gate scope decisions, not
   just engineering convenience.
5. Bounded pilot before scale — Varese-sized assumptions (e.g. a linear `mostAligned`
   search) are acceptable now and explicitly flagged as needing rework before wider
   launch, not silently left as an oversight.
