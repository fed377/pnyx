/** Compact relative time. */
export function timeAgo(at: number, now: number = Date.now()): string {
  const s = Math.max(1, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

export const pct = (n: number) => `${Math.round(n)}%`;

/** Abbreviates a count the way social counters do — 1.2K, 866, 3.4M. */
export function compactCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}K`.replace(".0K", "K");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
}

/** Spelled-out relative time — "30 minutes ago" — for surfaces that read as
 * captions rather than metadata rows (compare the compact `timeAgo` above). */
export function timeAgoLong(at: number, now: number = Date.now()): string {
  const s = Math.max(1, Math.round((now - at) / 1000));
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (s < 60) return unit(s, "second");
  const m = Math.round(s / 60);
  if (m < 60) return unit(m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return unit(h, "hour");
  const d = Math.round(h / 24);
  if (d < 7) return unit(d, "day");
  return unit(Math.round(d / 7), "week");
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
