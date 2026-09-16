import { Platform } from "react-native";

/**
 * Warm neutral ramp — monochrome by brief (black, greys, white; colour is
 * reserved for meaningful data — grid positions, the vote up/down semantics —
 * never for UI chrome). Matches the Figma handoff's light design.
 */
export const c = {
  bg: "#eeece8",
  app: "#f2f0ec",
  surface: "#faf9f6",
  surface2: "#f0eeea",
  surface3: "#e6e3dd",
  line: "#dcd9d2",
  lineSoft: "#e8e5df",
  text: "#161513",
  textDim: "#6b6862",
  textFaint: "#9a9690",
  up: "#3fbf8f",
  upSoft: "rgba(63,191,143,0.14)",
  down: "#e5626f",
  downSoft: "rgba(229,98,111,0.14)",
  onAccent: "#ffffff",
  scrim: "rgba(20,19,17,0.5)",
  overlay: "rgba(10,10,9,0.55)",
} as const;

/**
 * The one exception to the monochrome brief: a brushed-steel gradient reserved
 * for "live"/in-progress state (an uploading or processing button, a toggle
 * that's on) — never decoration. Light-to-dark slate, per the Figma component sheet.
 */
export const STEEL_GRADIENT = ["#aeb4bf", "#767c88"] as const;

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

/**
 * Familjen Grotesk — the display typeface from the Figma component sheet's
 * Specimens page, used for every "Display/*" role (wordmark through the
 * post composer). Smaller "Text/*" roles (body copy, captions, labels) stay
 * on the system font, which is why this isn't just a global fontFamily.
 */
export const display = {
  regular: "FamiljenGrotesk_400Regular",
  medium: "FamiljenGrotesk_500Medium",
  semibold: "FamiljenGrotesk_600SemiBold",
  bold: "FamiljenGrotesk_700Bold",
} as const;

/** Height of the floating tab bar — tall enough for an icon and a label under it. */
export const NAV_H = 64;
/**
 * The floating tab bar's margin from the bottom edge — small enough to sit
 * close to the edge without touching it (see the `barBottom` calc in
 * `(tabs)/_layout.tsx`, which floors the safe-area inset at this value).
 */
export const NAV_INSET = s[2];
/** The bar's margin from the left/right edges — wider than the vertical
 * inset on purpose, so the floating pill doesn't read as edge-to-edge. */
export const NAV_SIDE_INSET = s[4];
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

function rgbToHls(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, l, 0];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, l, s];
}

function hlsToRgb(h: number, l: number, s: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
}

/**
 * A light-to-dark two-stop gradient in `hex`'s own hue, for a glossy
 * app-icon-style fill instead of one flat tint — derived from the color
 * itself rather than picked by hand, so every named color on a grid gets one
 * automatically. Deliberately keeps saturation up rather than washing the
 * light stop out toward white: at high lightness hue barely reads any more,
 * which is exactly what made close-hue neighbors (Culture's Lilac/Indigo/
 * Electric, say) collapse into each other before this.
 */
export function glossGradient(hex: string): [string, string] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((x) => x + x).join("") : clean;
  const n = parseInt(full, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const [h, l, s] = rgbToHls(r, g, b);
  const toHex = ([rr, gg, bb]: [number, number, number]) =>
    `#${[rr, gg, bb]
      .map((c) => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, "0").toUpperCase())
      .join("")}`;
  const light = hlsToRgb(h, Math.min(0.85, l + 0.1), Math.min(1, s + 0.03));
  const dark = hlsToRgb(h, Math.max(0.1, l - 0.24), Math.min(1, s + 0.12));
  return [toHex(light), toHex(dark)];
}
