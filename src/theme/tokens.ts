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

export const DEFAULT_ACCENT = "#8B5CF6";

/** 4px base scale. */
export const s = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;

export const r = { sm: 8, md: 12, lg: 18, full: 999 } as const;

export const f = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 34 } as const;

export const NAV_H = 60;

export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
