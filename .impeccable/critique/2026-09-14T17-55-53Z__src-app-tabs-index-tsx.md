---
designHealthScore: 19
designHealthMax: 32
designSpecificity: partial
priorityIssues: [object Object],[object Object],[object Object],[object Object],[object Object]
target_identity: "file:C:\\Users\\user\\Desktop\\pnyx_app\\pnyx-native\\src\\app\\(tabs)\\index.tsx"
target_fingerprint: "sha256:4792681729b14beb19a4c8ebe239cd9b6e31fdb66fc2317fc2c4200a34c83845"
target_path: "C:\\Users\\user\\Desktop\\pnyx_app\\pnyx-native\\src\\app\\(tabs)\\index.tsx"
timestamp: 2026-09-14T17-55-53Z
slug: src-app-tabs-index-tsx
---
# Critique: Home screen (src/app/(tabs)/index.tsx)

## Design Specificity Verdict

Not a generic reskin, but not fully authored either. The derived-identity concept surfaces concretely in real places — Avatar's ring color pulled live from `nearestPoint("mind", positions.mind).hex`, PostCard's category chip computed from `primaryGrid(content)`, alignment % rendered inline on every card. That's real craft specific to PNYX. But strip the data-driven accents and the skeleton — greeting header, avatar-story rail, vertical like/comment/share feed — is Instagram's home screen unchanged. Decoration is bespoke; structure is not.

## Design Health Score (Nielsen's 10 Heuristics) — 19/32 applicable

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of system status | 3/4 | No distinct error state for a failed refresh() — spinner just stops silently (index.tsx:114-119). |
| 2 | Match with real world | 3/4 | "Alignment" filter language is plain but the concept itself is never explained on-screen. |
| 3 | User control and freedom | 2/4 | UnlockBanner can't be dismissed or collapsed; same visual weight every visit until exactly 50 votes (index.tsx:45-80). |
| 4 | Consistency and standards | 2/4 | StoryShell.closeBtn skips the app-wide squircle convention; press-feedback scaleTo values (0.88-0.98) and action-icon sizes (16-24px) vary with no apparent rule. |
| 5 | Error prevention | 3/4 | Vote lock is irreversible with only a post-hoc toast, not a pre-confirm. |
| 6 | Recognition rather than recall | 2/4 | Bare alignment % on every card, no legend anywhere on Home (PostCard.tsx:110). |
| 7 | Flexibility/efficiency | n/a | no shortcuts surfaced on this screen to evaluate |
| 8 | Aesthetic/minimalist design | 3/4 | Strong monochrome discipline overall, undercut by 14 hardcoded hex/rgba literals bypassing c.* tokens. |
| 9 | Help recognizing/recovering from errors | 1/4 | No failed-refresh UI at all; c.textFaint (#9a9690) on c.app/c.surface measures ~2.6:1 contrast, failing WCAG AA 4.5:1. |
| 10 | Help and documentation | n/a | Operate-mode task screen, full docs not expected |

## Overall Impression

A competently built, data-authentic feed screen let down by two things: it borrows its skeleton wholesale from category convention rather than expressing the five-grid concept structurally, and a real accessibility/contrast debt (6 missing labels, a failing text-contrast token, 6 under-44pt hit targets, 3 compensated by hitSlop) has accumulated underneath a visually polished surface.

## What's Working

- Avatar's ring color sourced from a real grid position (Avatar.tsx:38) — identity chrome computed, not decorative.
- UNLOCK_PADDING concentric radius math (index.tsx:19,76) — real rigor, not copy-pasted tokens.
- Chip's interpolateColor fill transition (Primitives.tsx:207-225) — considered, alive, on-brief.

## Priority Issues

1. P1 — No legend for alignment %. namePct (PostCard.tsx:110) shows a bare percentage with zero explanation anywhere on Home. Fix: one-time inline tooltip or persistent "i" affordance. Command: clarify
2. P1 — Failing text contrast + missing accessibility labels. c.textFaint ~2.6:1 on timestamps/captions/section titles; HotTakeViewer reaction counts and notification badge count have no accessibilityLabel. Fix: raise textFaint to >=4.5:1; add labels to icon+count pairs. Command: harden
3. P1 — Unlock banner never escalates or can't be dismissed. Identical visual weight at vote 2 and vote 48 (index.tsx:45-80). Fix: escalate treatment near UNLOCK_AT; allow per-session collapse. Command: delight
4. P2 — Header hierarchy splits identity/category unnaturally. PostCard.tsx:91-113 puts chip top-left, author top-right. Fix: author-first, category as trailing tag. Command: layout
5. P2 — Design-system drift: 14 off-scale spacing/font values and duplicated ad-hoc button patterns (e.g. greeting fontSize:30, unlockNum fontSize:44 off the f scale; raw Pressable used instead of AnimatedPressable/IconBtn in _layout.tsx and StoryShell.tsx). Command: polish

## Persona Red Flags

- Jordan (confused first-timer): three unexplained concepts stacked in one screenful (alignment %, alignment toggle, unlock countdown), no tooltip tying them together.
- Sam (screen reader): UnlockBanner is labeled well, but reaction-count pills and the notification badge are not.
- Riley (stress tester): long author names risk colliding with the trailing alignment % suffix; failed pull-to-refresh has no error path.

## Minor Observations

- StoryShell.closeBtn (32x32) and Chrome's back button (36x36) are under 44pt on paper but carry hitSlop={8}, giving ~48-52pt effective targets.
- PostCard.share() and HotTakeViewer.share() duplicate an identical try/catch/toast shape.
- chipSelected/chipTextSelected styles in Primitives.tsx are dead code.

## Questions to Consider

1. Should Home show a raw alignment % at all, or would a coarser color-based signal fit the "derived, not stated" ethos better?
2. Home's avatar rings only ever reflect the Mind grid — is this screen representing five dimensions, or one dimension with four invisible until unlock?
3. UnlockBanner treats vote 1 and vote 49 identically — what would make the pre-unlock journey itself feel like progress?
