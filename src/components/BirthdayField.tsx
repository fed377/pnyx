import { useRef } from "react";
import type { RefObject } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputInstance } from "react-native";
import { MIN_AGE } from "@/lib/birthday";
import { c, f, r, s, squircle } from "@/theme/tokens";

/**
 * Day, month and year boxes that hop to the next box once one is full. Used
 * on the create-account screen and by onboarding, for accounts that signed
 * up with Google and never gave a birthday.
 */
export function BirthdayField({
  day,
  setDay,
  month,
  setMonth,
  year,
  setYear,
  invalid,
}: {
  day: string;
  setDay: (v: string) => void;
  month: string;
  setMonth: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  invalid: boolean;
}) {
  const monthRef = useRef<TextInputInstance>(null);
  const yearRef = useRef<TextInputInstance>(null);

  // Some host environments (the RN test renderer among them) don't implement the
  // imperative handle — auto-advance is a nicety, so a missing focus() is a no-op.
  const focusNext = (ref: RefObject<TextInputInstance | null>) => () => {
    try {
      ref.current?.focus();
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Birthday</Text>
      <View style={styles.dateRow}>
        <TextInput
          value={day}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, 2);
            setDay(digits);
            if (digits.length === 2) focusNext(monthRef)();
          }}
          placeholder="DD"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Birth day"
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.dateInput, styles.dateInputSmall]}
        />
        <TextInput
          ref={monthRef}
          value={month}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, 2);
            setMonth(digits);
            if (digits.length === 2) focusNext(yearRef)();
          }}
          placeholder="MM"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Birth month"
          keyboardType="number-pad"
          maxLength={2}
          style={[styles.dateInput, styles.dateInputSmall]}
        />
        <TextInput
          ref={yearRef}
          value={year}
          onChangeText={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))}
          placeholder="YYYY"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Birth year"
          keyboardType="number-pad"
          maxLength={4}
          style={[styles.dateInput, styles.dateInputWide]}
        />
      </View>
      {invalid && <Text style={styles.error}>Enter a valid birth date.</Text>}
      <Text style={styles.hint}>You must be {MIN_AGE} or older to use PNYX.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: c.textFaint, fontSize: f.xs, letterSpacing: 0.9, textTransform: "uppercase" },
  dateRow: { flexDirection: "row", gap: s[2] },
  dateInput: {
    color: c.text,
    fontSize: f.md,
    textAlign: "center",
    paddingVertical: 12,
    borderRadius: r.sm,
    backgroundColor: c.surface2,
    ...squircle,
  },
  dateInputSmall: { width: 64 },
  dateInputWide: { width: 92 },
  hint: { color: c.textFaint, fontSize: f.xs },
  error: { color: c.down, fontSize: f.sm },
});
