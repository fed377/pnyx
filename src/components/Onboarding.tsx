import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Field } from "./Primitives";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";

const MIN_AGE = 16;
const BIO_MAX = 160;
const HANDLE_RE = /^[a-z0-9._]+$/i;

/** True calendar validity, not just in-range digits — catches Feb 30, day 0, etc. */
function toBirthDate(day: string, month: string, year: string): Date | null {
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

function ageOn(birth: Date, today = new Date()): number {
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age--;
  return age;
}

/** One more thing before you're in: a username, a birthday (checked against the minimum age), and a bio. */
export function Onboarding() {
  const { state, completeOnboarding } = useStore();
  const insets = useSafeAreaInsets();

  const [handle, setHandle] = useState(state.profile.handle);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [bio, setBio] = useState(state.profile.bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooYoung, setTooYoung] = useState(false);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const birth = useMemo(() => toBirthDate(day, month, year), [day, month, year]);
  const dateStarted = day.length > 0 || month.length > 0 || year.length > 0;
  const dateInvalid = dateStarted && day.length > 0 && month.length > 0 && year.length === 4 && !birth;

  const handleValid = HANDLE_RE.test(handle.trim()) && handle.trim().length >= 2 && handle.trim().length <= 30;
  const bioValid = bio.trim().length >= 3;
  const canSubmit = handleValid && Boolean(birth) && bioValid && !busy;

  // Some host environments (the RN test renderer among them) don't implement the
  // imperative handle — auto-advance is a nicety, so a missing focus() is a no-op.
  const focusNext = (ref: RefObject<TextInput | null>) => () => {
    try {
      ref.current?.focus();
    } catch {
      // ignore
    }
  };

  const submit = async () => {
    setError(null);
    if (!birth) return;

    const age = ageOn(birth);
    if (age < MIN_AGE) {
      setTooYoung(true);
      return;
    }

    setBusy(true);
    try {
      await completeOnboarding({
        handle: handle.trim(),
        bio: bio.trim(),
        birthday: birth.toISOString().slice(0, 10),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (tooYoung) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.wordmark}>PNYX</Text>
        <View style={styles.blockCard}>
          <Text style={styles.blockTitle}>You need to be {MIN_AGE} or older</Text>
          <Text style={styles.blockBody}>
            PNYX isn&apos;t available to people under {MIN_AGE}. If you entered your birthday by mistake, you can go
            back and try again.
          </Text>
          <Btn label="Go back" onPress={() => setTooYoung(false)} wide />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + s[6] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.wordmark}>PNYX</Text>
        <Text style={styles.tagline}>One more thing before you&apos;re in.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.handleRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              value={handle}
              onChangeText={setHandle}
              placeholder="yourname"
              placeholderTextColor={c.textFaint}
              accessibilityLabel="Username"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              style={styles.handleInput}
            />
          </View>
          {handle.length > 0 && !handleValid && (
            <Text style={styles.hint}>2–30 characters: letters, numbers, dots, or underscores.</Text>
          )}
        </View>

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
          {dateInvalid && <Text style={styles.hint}>Enter a valid birth date.</Text>}
          <Text style={styles.note}>You must be {MIN_AGE} or older to use PNYX.</Text>
        </View>

        <Field
          label="Bio"
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
          placeholder="What do you actually think?"
          multiline
          maxLength={BIO_MAX}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Btn
          label={busy ? "Working…" : "Continue"}
          variant="accent"
          wide
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: s[5] },
  content: { padding: s[5], paddingBottom: s[7], gap: s[4] },
  wordmark: { color: c.text, fontSize: 24, fontWeight: "700", letterSpacing: 6 },
  tagline: { color: c.textDim, fontSize: f.md, lineHeight: 22, marginBottom: s[2], maxWidth: 300 },
  field: { gap: 6 },
  label: {
    color: c.textFaint,
    fontSize: f.xs,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: r.sm,
    backgroundColor: c.surface2,
    paddingLeft: s[3],
    ...squircle,
  },
  at: { color: c.textFaint, fontSize: f.md },
  handleInput: {
    flex: 1,
    color: c.text,
    fontSize: f.md,
    paddingHorizontal: s[2],
    paddingVertical: 12,
  },
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
  hint: { color: c.down, fontSize: f.xs },
  note: { color: c.textFaint, fontSize: f.xs },
  error: { color: c.down, fontSize: f.sm },
  blockCard: {
    width: "100%",
    marginTop: s[5],
    padding: s[5],
    gap: s[3],
    borderRadius: r.lg,
    backgroundColor: c.surface,
    ...squircle,
  },
  blockTitle: { color: c.text, fontSize: f.lg, fontWeight: "700" },
  blockBody: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
});
