import { Platform } from "react-native";

/** Cool neutral ramp — no pure black, no pure white. */
export const c = {
  bg: "#08080d",
  app: "#0b0b11",
  surface: "#13131b",
  surface2: "#1a1a24",
  surface3: "#22222e",
  line: "#24242f",
  lineSoft: "#1c1c26",
  text: "#ecedf3",
  textDim: "#9797a9",
  textFaint: "#66667a",
  up: "#3fbf8f",
  upSoft: "rgba(63,191,143,0.14)",
  down: "#e5626f",
  downSoft: "rgba(229,98,111,0.14)",
  onAccent: "#ffffff",
  scrim: "rgba(4,4,8,0.62)",
  overlay: "rgba(8,8,13,0.66)",
} as const;

/** Shown in place of the Mind-grid color while a profile is still locked — a calm, undetermined blue, not a brand color. */
export const LOCKED_ACCENT = "#4F86D1";

/** 4px base scale. */
export const s = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

export const r = { sm: 12, md: 16, lg: 24, full: 999 } as const;

/**
 * Apple's "continuous" corner curve (a squircle, not an arc-cornered rounded
 * rect) — iOS only; Android silently ignores `borderCurve` and falls back to
 * its own standard rounded corner, which is the native convention there.
 * Spread onto any container's style to get the shape without duplicating the
 * prop everywhere: `style={[styles.card, squircle]}`.
 */
export const squircle = { borderCurve: "continuous" } as const;

export const f = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 34 } as const;

/** Height of the floating tab bar — icons only, no labels to make room for. */
export const NAV_H = 52;
/**
 * The floating tab bar's margin from the screen edge — the same on the left,
 * the right and the bottom, so the pill sits evenly inside the screen. Small
 * enough to sit close to the edge without touching it.
 */
export const NAV_INSET = s[2];
/** Bottom clearance scrollable tab-screen content needs now that the tab bar floats over it. */
export const TAB_BAR_CLEARANCE = NAV_INSET + NAV_H + s[3];

export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Flattens `hex` over `base` at `ratio` (0..1) into one opaque color — the solid
 * stand-in for what used to be a translucent `hexToRgba(hex, ratio)` panel, so a
 * tinted container reads the same but is never see-through.
 */
export function mixHex(hex: string, base: string, ratio: number): string {
  const parse = (h: string) => {
    const clean = h.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((x) => x + x).join("") : clean;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [hr, hg, hb] = parse(hex);
  const [br, bg, bb] = parse(base);
  const mix = (a: number, b: number) => Math.round(a * ratio + b * (1 - ratio));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(hr, br))}${toHex(mix(hg, bg))}${toHex(mix(hb, bb))}`;
}
