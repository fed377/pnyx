import { Easing, FadeIn, FadeInDown, FadeOut, FadeOutDown, LinearTransition } from "react-native-reanimated";

/**
 * One set of timings for the whole app, so things that happen together move
 * together. Short for feedback, longer for things that cover the screen.
 */
export const duration = {
  /** Press feedback, toggles, small state flips. */
  quick: 160,
  /** Things appearing or leaving in place: rows, states, toasts. */
  base: 240,
  /** Whole-screen covers and hand-offs. */
  slow: 320,
} as const;

export const ease = {
  /** Arriving: fast start, gentle landing. */
  out: Easing.out(Easing.cubic),
  /** Leaving: gentle start, quick finish. */
  in: Easing.in(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
} as const;

export const spring = {
  /** Indicators and pills that follow a selection. */
  snappy: { damping: 22, stiffness: 260, mass: 0.7 },
  /** Larger surfaces settling into place. */
  gentle: { damping: 24, stiffness: 220, mass: 0.8 },
  /** Press release: a quick settle with no visible bounce. */
  release: { damping: 18, stiffness: 340, mass: 0.6 },
} as const;

/**
 * Reanimated layout animations on the same timings. Functions, not shared
 * instances: chaining `.delay()` onto a builder changes it in place.
 */
export const enter = {
  fade: () => FadeIn.duration(duration.base).easing(ease.out),
  rise: () => FadeInDown.duration(duration.base).easing(ease.out),
} as const;

export const exit = {
  fade: () => FadeOut.duration(duration.quick).easing(ease.in),
  sink: () => FadeOutDown.duration(duration.quick).easing(ease.in),
} as const;

/** For views pushed around by something appearing beside them, so they slide instead of jumping. */
export const move = () => LinearTransition.duration(duration.base).easing(ease.inOut);

/**
 * A skeleton waits this long before showing, so a fast load goes straight to
 * the content instead of flashing a placeholder for a frame or two.
 */
export const SKELETON_DELAY_MS = 180;
