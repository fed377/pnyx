/** Matches pnyx-backend's authRoutes.ts (domain.ts's MIN_AGE) — kept in sync by hand. */
export const MIN_AGE = 16;

/** True calendar validity, not just in-range digits — catches Feb 30, day 0, etc. */
export function toBirthDate(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!d || !m || !y) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) return null;

  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (date.getTime() > Date.now()) return null;
  return date;
}

export function ageOn(birth: Date, today = new Date()): number {
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age--;
  return age;
}

/** YYYY-MM-DD, matching what the server's birthday field expects. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
