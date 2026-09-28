# PNYX — Monetization Plan

Status: planning draft, 2026-09-28. All money figures are **estimates** for planning, not validated
numbers. USD vendor prices are converted roughly 1:1 to EUR. Re-check each vendor's price page
before committing to a budget, because several rates below are promotional or tiered.

This builds on the business model already recorded in `PRODUCT.md`: the consumer app stays free
and ad-free, revenue comes from B2B aggregated-data subscriptions, and there is a smaller
consumer premium tier. This document gives prices, costs, legal limits and an order of rollout
for each option, and adds two options that fit the product: sponsored questions and research
partnerships.

---

## 1. Summary

| # | Revenue stream | Fit with product principles | When | Share of revenue at scale (est.) |
|---|---|---|---|---|
| A | **PNYX+ consumer subscription** | Good. The hooks already exist (`state.premium`) | Pilot (month 2–3) | 15–25 % |
| B | **B2B Insights subscriptions** (anonymized aggregates) | Good, with strict GDPR limits | City scale (≥ 15k MAU) | 25–35 % |
| C | **Sponsored Questions** (labelled paid content, aggregate results only) | Good, if sponsored items don't move grids | Pilot (small local deals) | 35–55 % |
| D | **Research & institutional partnerships** (university, municipality) | Very good | Pilot, first revenue | < 5 % (large share in the pilot) |
| E | Small one-off in-app purchases (cosmetics, identity card export) | Acceptable | After A | < 5 % |
| ✗ | Programmatic / targeted advertising | **Rejected.** See §3 | Never | — |
| ✗ | Paying to change your position, boosts, or paywalled privacy | **Rejected.** Breaks principle 1 | Never | — |

**Recommendation:** start revenue in the Varese pilot with **D** (research partnership) and **C**
(a few local sponsored questions), ship **A** once the 50-vote unlock is retaining users, and
open **B** only when the population can support anonymous aggregates (≥ ~15k MAU in a geography).
The biggest cost risk is not AI scoring (the spec leaves this open, but it is cheap). It is
**video delivery egress** and **analytics event volume**, and both can be fixed with
architecture choices made now (§5.3).

---

## 2. What the codebase already supports

- `profiles.premium` is a server-owned account field. The client reads it through `/me`
  (`src/api/client.ts`, `src/state/store.tsx` `"premium"` action) and cannot set it. That is
  the right shape for a store-billing webhook to write to.
- Premium gates that already exist:
  - `src/app/stats.tsx`: "Deeper history" locked row ("Premium isn't available to buy yet").
  - `src/app/(tabs)/people.tsx`: `WORLD_LIMIT = 10` vs `WORLD_LIMIT_PREMIUM = 50` for "Most
    aligned in the world".
- `src/lib/feed.ts` already reserves every 20th slot for an against-the-grain item. Sponsored
  questions could use a similar fixed, capped slot.
- PostHog analytics (`src/analytics/analytics.ts`) already has the unlock and retention funnel
  needed to measure paywall conversion. No new analytics vendor is needed.
- Missing: a purchase SDK, a paywall screen, a restore-purchases entry in Settings, a billing
  webhook on the backend, and a B2B dashboard (a separate web app).

---

## 3. Legal limits that shape every option

These limits are hard. They are why some options are rejected, not just ranked low.

1. **The Values grid is special-category data.** Its axes are *Progressive ↔ Traditionalist*
   and *Individualist ↔ Communitarian* (`src/lib/grids.ts`). That is political opinion under
   **GDPR Art. 9**. Consequences:
   - Using it to target ads is barred by the **DSA Art. 26(3)**, which bans ads based on
     profiling with special-category data. Targeting minors with profiling-based ads is barred
     by **Art. 28**. The app collects birthdays, so under-18 users must be excluded from any
     sponsored targeting.
   - Any B2B output needs **explicit consent** for the research or aggregate use, or truly
     anonymous output. Pseudonymous output is not enough. Plan for a **DPIA** (Art. 35) before
     launching B or C.
2. **Anonymity is only real with large cells.** Only publish an aggregate cell (geography ×
   age band × grid region) with **k ≥ 50** distinct users. Suppress smaller cells and add
   calibrated noise (differential privacy) to published numbers. Never export individual rows.
   In a Varese-sized population most fine-grained cells will be suppressed. That is why B waits
   for scale.
3. **Store rules.** Digital features unlocked inside the app must use Apple and Google in-app
   purchase. B2B subscriptions sold on the web to businesses are outside the stores and use
   Stripe.
4. **Never paywall** Forget Me, privacy tiers, blocking or reporting, or the Speaker tier. The
   Speaker tier supplies content, so paywalling it would starve the feed.

---

## 4. The options in detail

### A. PNYX+ (consumer subscription)

**Price (Italy, VAT included):** **€3.99 / month** or **€29.99 / year** (a 37 % discount, to push
annual plans). Offer a 7-day free trial, shown only after the identity unlock at 50 votes, when
the user values the product most.

**What it includes.** Every feature only reveals more of the user's *own* data or their
matching. Nothing changes a grid position.

| Feature | Already gated? | Build effort |
|---|---|---|
| Deeper history: month-by-month drift beyond the 250-vote window | Yes (stats.tsx) | M (backend must keep snapshots) |
| Top 50 "most aligned in the world" instead of 10 | Yes (people.tsx) | S |
| Per-grid alignment breakdown with any person | No | S |
| Advanced People filters (by grid region, city, age band) | No | M |
| "Who aligned with you this week" digest | No | M |
| Shareable high-resolution identity card and crest variants | No | S |

**Net revenue per subscriber** (Italy has 22 % VAT, which the stores remit; store commission
is 15 % under the Apple Small Business Program and Google's first-$1M tier):

| Plan | Gross | Without VAT | After 15 % commission | Per month |
|---|---|---|---|---|
| Monthly | €3.99 | €3.27 | €2.78 | **€2.78** |
| Annual | €29.99 | €24.58 | €20.89 | **€1.74** |
| 50/50 mix | | | | **≈ €2.26** |

**Expected conversion:** 1–2 % of MAU in the pilot, 2.5–4 % at maturity. Typical for identity
and social apps with a strong unlock moment.

**Implementation (Expo SDK 57):**
- Use **RevenueCat** (`react-native-purchases`). It is free up to $2.5k monthly tracked
  revenue, then 1 %. It needs a dev or EAS build, not Expo Go. Point RevenueCat's webhook at
  the backend, which sets `profiles.premium`; the client already syncs it. The alternative,
  `expo-iap` plus your own receipt validation, has no fee but takes about 2 weeks more work and
  needs ongoing upkeep.
- New pieces: a paywall route (`src/app/premium.tsx`), a "Restore purchases" row and a
  "Manage subscription" deep link in `settings.tsx`, and changing the locked rows in stats and
  people into call-to-action buttons.
- Effort: about 1.5–2 weeks for one developer, including App Store Connect and Play Console
  product setup and review.

### B. B2B Insights (aggregate opinion-tendency data)

`PRODUCT.md`'s placeholder tiers are $19, $59 and $159 a month. **These are too low for B2B
data.** At those prices you would need hundreds of customers to cover one salary, and support
costs per account don't shrink with price. Two options:

| | Option B1: founders' tiers (self-serve) | Option B2: repriced (recommended) |
|---|---|---|
| Entry | €19/mo: city-level dashboard, 5 grids, monthly | **Explorer €49/mo**: one city, monthly trends, grid-level only |
| Middle | €59/mo: + age bands, weekly | **Professional €299/mo**: several cities, age bands, weekly, topic cuts, CSV of aggregates |
| Top | €159/mo: + API | **Enterprise from €1,500/mo**: API, custom segments, analyst support, SLA |
| Projects | — | **Commissioned studies €5k–25k** each: a custom question set run through Sponsored Questions (C) with a report |

Customers: local businesses and chambers of commerce, marketing agencies, municipalities and
regions, NGOs, media, and academic researchers (offer an academic price at 50 % off).

Costs to deliver:
- A web dashboard (Next.js or similar) that reads **pre-aggregated, k-thresholded** tables.
  Never let it query raw votes. About 4–6 weeks to build.
- A nightly aggregation job in the backend, with suppression and noise applied at write time.
- Stripe Billing: about 1.5 % + €0.25 per EEA card payment, plus 0.7 % for Billing. Invoices
  go through the Italian SdI e-invoicing system (your accountant's software, or a
  Stripe-to-SdI connector at about €10–30/mo).
- Legal: the DPIA, a data-licensing template contract, and a written anonymization method.

**Gate:** don't sell subscriptions until at least one city has ≥ 15k MAU and at least 70 % of
the cells a customer would see pass k ≥ 50. Before that, sell **projects** (C and D) only.

### C. Sponsored Questions

A brand, institution or local business pays to put a clearly labelled item ("Sponsored · Comune
di Varese") into the feed. Users react as normal. The sponsor receives **only aggregate
results** broken down by grid region, age band and city, with the same k-threshold as B.

Rules that keep it within the principles:
- **Sponsored items never move grids.** Score them with confidence `C = 0` in the movement
  equation. Otherwise a sponsor could pay to shift users' identities, which breaks principle 1.
- Cap at **1 in 25 slots**. Never place a sponsored item in the first 50 cold-start reels.
- Never target by grid position (DSA Art. 26(3)). Target only by city and age ≥ 18.
- Users can hide sponsored items. PNYX+ subscribers could get this as an extra perk.

**Pricing:** about **€0.10–0.25 per reaction collected**, with a €250 minimum. A 5,000-response
local study costs €500–1,250. Capacity is not the constraint. At 250k MAU with a 1-in-25 cap
there are about 6M sponsored impressions a month, so demand sets the revenue.

Build effort: sponsored flag and label in PostCard and the feed, an advertiser brief form,
manual approval, and a results report (a PDF or a B2B dashboard view). About 2–3 weeks. Sell
by hand during the pilot. Only build self-serve at national scale.

### D. Research & institutional partnerships

Varese has the Università dell'Insubria and an active municipality and province. A paid pilot
partnership (€3k–15k per semester) gives early revenue, credibility, and an ethics or data
review that can carry over into the DPIA. Also consider Italian and EU funding. This is not
revenue, but it extends runway: Smart&Start Italia (Invitalia), regional Lombardy innovation
calls, and later the EIC Accelerator.

### E. One-off purchases (optional)

Crest colour variants and frames, a printed or high-resolution identity poster, and extra
profile themes, each €0.99–2.99. Cosmetic only. This is low revenue and exists mainly to
monetize non-subscribers. Consider it after A is stable.

### Rejected options

- **Programmatic ads (AdMob and similar).** Italian eCPMs are roughly €2–8. At 60 reels per
  DAU per day and one ad per 10 reels, that is about 63 impressions, or €0.13–0.50
  per MAU per month (€30k–125k/mo at 250k MAU). That is competitive on paper. It is still rejected. It contradicts the ad-free positioning.
  Personalized ads are legally unusable with Art. 9 profiles. Contextual-only ads earn a
  fraction of that. And ad SDKs send device data to third parties, which clashes with the
  "what not to log" analytics stance.
- **Selling or exporting individual profiles or votes.** Illegal without specific consent, and
  it destroys trust.
- **Paying for position changes, boosts, or tier switches.** Breaks "positions are earned,
  never asserted".
- **Paywalling the Speaker tier.** Cuts content supply.

---

## 5. Costs

### 5.1 Fixed and one-off costs

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | €99 / year | Required for the App Store |
| Google Play developer | $25 one-off | |
| Company (Italian SRL) formation | €2k–4k one-off | Notary and registration. Simplified SRL is possible |
| Accountant (commercialista) | €2k–5k / year | E-invoicing, VAT, bookkeeping |
| GDPR counsel: DPIA, privacy policy, B2B data contracts | €5k–15k one-off | Required before B or C (Art. 9 data) |
| Outsourced DPO (probably required: large-scale special-category processing) | €2k–6k / year | |
| EU trademark "PNYX" (EUIPO) | €850 (1 class), +€50 2nd, +€150 each further | Classes 9, 42 and 35 recommended |
| Cyber / professional liability insurance | €1k–2.5k / year | |
| EAS (Expo build service) | Free → $19 / mo (Starter) | Free tier is enough for the pilot |
| Domain, email, SMTP (Resend or Postmark) | ~€10–30 / mo | Supabase's built-in email is not for production |
| **Year-one fixed total** | **≈ €15k–35k** | Mostly legal, one-off |

### 5.2 Variable costs per user (monthly)

Assumptions: DAU/MAU 35 %; 60 reels per DAU per day, average 20 s, about 3 MB each; 5 % of users
are Speakers posting 4 times a month (0.2 posts per MAU per month); about 1,300 analytics events
per MAU per month.

| Driver | Per MAU / month | How |
|---|---|---|
| **Video delivery** | **~1.9 GB egress** | 0.35 × 30 × 60 × 3 MB |
| AI scoring (Gemini Flash, video) | ~€0.002–0.003 | ≈ 6k video tokens + output per 20 s post ≈ €0.01–0.015 per post (Flash promo rate is $0.75/M input to Dec 2026, **doubling to $1.50/M on 1 Jan 2027**) |
| DB rows (votes) | ~630 rows, ~130 KB | Supabase disk $0.125/GB beyond the 8 GB included |
| Analytics events | ~1,300 events | PostHog: 1M free, then from $0.00005/event, **plus a person-profile surcharge on identified events** |
| Push notifications | €0 | Expo push is free |

**Conclusion:** AI scoring costs about **a quarter of a cent per user per month**, even at 2027
prices, so the spec's open question about AI cost per user is answered: it is not a real risk.
Video delivery and analytics are the real cost drivers.

### 5.3 Three architecture choices that decide the cost curve

1. **Serve video from Cloudflare R2 (no egress fees) or Bunny CDN, not Supabase Storage.**
   Supabase charges $0.09/GB of egress beyond 250 GB. At 20k MAU that is about 38 TB a month,
   or **roughly €3,400/mo**. The same traffic from R2 costs about €20 (storage plus read
   requests). From Bunny it costs about €190–380. The upload flow in `README.md` ("PUT the
   file bytes straight to storage") keeps the same shape. Only the signed-URL issuer changes.
   Transcode to 720p H.264 (and later HLS) at upload time, so each reel stays near 3 MB.
   Avoid managed video platforms priced per minute delivered (Cloudflare Stream, Mux) for the
   feed. At about $1 per 1,000 minutes delivered, 250k MAU would cost around €50k/mo.
2. **Sample high-volume analytics events.** Send `reel_viewed` for about 10 % of views, or
   aggregate per session into one `session_summary` event. Keep `vote_cast`, the unlock
   events, and the purchase or paywall events unsampled. Because `identifyUser()` makes every
   signed-in event an identified event, the per-profile surcharge makes unsampled PostHog at
   20k MAU a **€2k–4k/mo** line. Sampled, it drops to about €100–200. At national scale,
   self-hosting PostHog or moving to a warehouse is an option.
3. **Use the lowest-cost scoring settings.** Score video at low media resolution with a strict
   output schema and no extended thinking. Use Flash-Lite for comment and text moderation.
   Cache scores by content hash so re-uploads aren't scored twice.

### 5.4 Monthly running cost by scale

Team salaries are excluded (see the note below). "Naive" means Supabase Storage egress and
unsampled analytics. "Optimized" means the §5.3 choices.

| Line item | Pilot · 2k MAU | City · 20k MAU | National · 250k MAU |
|---|---|---|---|
| Supabase (plan + compute) | €30 (Pro + Small) | €140 (Pro + Large) | €1,000 (Team + XL + replica) |
| API hosting (Fastify) | €20 | €80 | €400–600 |
| Video delivery: naive → optimized | €320 → **€5** | €3,400 → **€20–300** | €42,000 → **€300–2,400** |
| AI scoring and moderation | €15 | €100 | €1,000 |
| Analytics: naive → optimized | €150–350 → **€0** | €2–4k → **€100–200** | €15k+ → **€500–1,000** |
| EAS, email, misc. | €10 | €40 | €150 |
| **Infra total (optimized)** | **≈ €80–100** | **≈ €500–850** | **≈ €3.5k–6k** |
| Human moderation (DSA notice-and-action, UGC) | founders | €800–1,500 (part-time) | €8k–12k (3 FTE) |
| **All-in excluding team** | **≈ €100** | **≈ €1.5k–2.3k** | **≈ €12k–18k** |

Note: a lean team of 3 in Italy (2 engineers and 1 business/ops), fully loaded, costs about
**€13k–18k/mo**. That, not infrastructure, is the real burn rate until national scale.

---

## 6. Revenue scenarios

Uses B2 pricing, the conversion rates from §4, and the recommended rollout timing.

| Stream (monthly) | Pilot · 2k MAU | City · 20k MAU | National · 250k MAU |
|---|---|---|---|
| A. PNYX+ (1.5 % / 2.5 % / 3 % × €2.26) | €70 | €1,130 | €17,000 |
| B. B2B subscriptions | — (gated) | €1,100 (5 × Explorer, 3 × Professional) | €18,000 (60 × Explorer, 25 × Professional, 5 × Enterprise) |
| B. Commissioned studies | — | €1,700 (≈ 1 per quarter) | €8,000 |
| C. Sponsored Questions | €500–1,000 | €3,000–6,000 | €30,000–60,000 |
| D. Research partnerships | €500–2,500 | €1,000 | €2,000 |
| **Total** | **≈ €1k–3.5k** | **≈ €8k–11k** | **≈ €75k–105k** |
| All-in cost excluding team (§5.4) | ≈ €100 | ≈ €1.5k–2.3k | ≈ €12k–18k |
| **Contribution before team** | **≈ +€1k–3.4k** | **≈ +€6k–9k** | **≈ +€60k–90k** |

Reading the table:
- **The pilot can't pay a team.** It can pay for itself on infrastructure and prove that people
  will pay. Plan the pilot on funding (grants or pre-seed), not revenue.
- Around **20k–35k MAU** in one or two cities, revenue covers infrastructure, moderation and a
  lean team of 3. That is the break-even target to aim fundraising at.
- At national scale, B2B and sponsored questions together bring in about 3–5× what consumer
  premium brings. This confirms the founders' B2B-first model, **but only at repriced tiers.**
  At the founders' tiers (B1) the B2B subscription line at 250k MAU is about €3.5k, not €18k.

---

## 7. Rollout

| Phase | Trigger | Ship | Success metric |
|---|---|---|---|
| **0. Before launch** (now) | — | SRL, DPIA started, R2 video path, analytics sampling, lower-cost Gemini settings | Infra cost per MAU < €0.05 |
| **1. Pilot revenue** | Pilot live | Research partnership (D). 2–4 hand-sold local Sponsored Questions (C) with `C = 0` scoring and an 18+ filter | ≥ €1k/mo committed. No drop in D7 retention in sponsored cohorts |
| **2. PNYX+** | D7 retention ≥ 20 % **and** ≥ 40 % of signups reach the 50-vote unlock | RevenueCat, paywall at unlock, restore and manage in Settings, backend webhook → `profiles.premium` | Trial start ≥ 8 % of unlocked users. Trial→paid ≥ 30 % |
| **3. B2B beta** | ≥ 15k MAU in a city, ≥ 70 % of cells pass k ≥ 50 | Aggregation job, B2B dashboard, Stripe + SdI invoicing, data-licensing contract | 10 paying accounts. Churn < 5 %/mo |
| **4. Scale** | Second city live | Self-serve Sponsored Questions, B2B API, commissioned-study packaging | Contribution before team > 0 |

### KPIs to add to PostHog now
`paywall_viewed` (source: stats / people / unlock), `trial_started`, `subscription_started`
(plan), `subscription_cancelled`, `sponsored_viewed`, `sponsored_voted`, `sponsored_hidden`.
Keep the existing rule: no content, no raw vote history.

---

## 8. Open decisions for the founders

1. B2B pricing: B1 (the $19/$59/$159 placeholders) or B2 (repriced)? This doc recommends B2.
2. Whether Sponsored Questions are acceptable under the "ad-free" promise. Recommended framing:
   "no ads, occasionally a labelled question from a local organisation; you can hide them."
3. Whether ad-free sponsored hiding is a PNYX+ perk or free for everyone. Free for everyone is
   more trustworthy. The perk version converts better.
4. Consent model for aggregate and research use: a separate opt-in at signup (safest under
   Art. 9), or rely on anonymization alone. Needs counsel's input.
5. Video pipeline owner: R2 plus your own transcoding (cheapest, more work), or Bunny Stream
   (less work, about 10× the delivery cost).
