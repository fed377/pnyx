import { ageOn, MIN_AGE, toBirthDate, toISODate } from "@/lib/birthday";

const YEAR = new Date().getFullYear();

describe("toBirthDate", () => {
  it("rejects an impossible calendar date", () => {
    expect(toBirthDate("30", "02", String(YEAR - 25))).toBeNull();
  });

  it("rejects a date in the future", () => {
    expect(toBirthDate("1", "1", String(YEAR + 1))).toBeNull();
  });

  it("accepts a valid date", () => {
    const birth = toBirthDate("15", "06", String(YEAR - 25));
    expect(birth).not.toBeNull();
    expect(birth!.getDate()).toBe(15);
    expect(birth!.getMonth()).toBe(5);
  });
});

describe("ageOn / MIN_AGE — the account-creation age gate", () => {
  it("rejects someone under the minimum age", () => {
    const birth = toBirthDate("15", "06", String(YEAR - 10))!;
    expect(ageOn(birth)).toBeLessThan(MIN_AGE);
  });

  it("lets someone at or above the minimum age through", () => {
    const birth = toBirthDate("15", "06", String(YEAR - 25))!;
    expect(ageOn(birth)).toBeGreaterThanOrEqual(MIN_AGE);
  });

  it("doesn't count this year's birthday early", () => {
    // Turns 16 today in ten years — not yet 16 if "today" is a day before that.
    const birth = new Date(YEAR - 16, 5, 15);
    const dayBefore = new Date(YEAR, 5, 14);
    expect(ageOn(birth, dayBefore)).toBe(15);
  });
});

describe("toISODate", () => {
  it("formats as YYYY-MM-DD for the signup request", () => {
    expect(toISODate(new Date(Date.UTC(2000, 0, 5)))).toBe("2000-01-05");
  });
});
