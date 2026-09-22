import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "./AnimatedPressable";
import { GoogleIcon } from "./GoogleIcon";
import { Icon } from "./Icon";
import { Btn } from "./Primitives";
import { API_URL, TERMS_URL } from "@/api/client";
import { ageOn, MIN_AGE, toBirthDate, toISODate } from "@/lib/birthday";
import { useSession } from "@/state/session";
import { c, display, f, r, s, squircle } from "@/theme/tokens";

const HANDLE_RE = /^[a-z0-9._]+$/i;
const HANDLE_CHECK_DEBOUNCE_MS = 400;

type HandleStatus = "idle" | "checking" | "available" | "taken";

/* ── Shared field-group primitives ───────────────────────────────────────────
 * The mockups group related fields into one rounded card, divided internally
 * by hairlines, rather than each field being its own separate pill. */

function FieldGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function GroupRow({ children, first = false }: { children: ReactNode; first?: boolean }) {
  return <View style={[styles.row, !first && styles.rowDivider]}>{children}</View>;
}

function PasswordRow({
  value,
  onChangeText,
  placeholder,
  first = false,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  first?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <GroupRow first={first}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        accessibilityLabel="Password"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!visible}
        style={styles.rowInput}
      />
      <AnimatedPressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        scaleTo={0.85}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} color={c.textDim} />
      </AnimatedPressable>
    </GroupRow>
  );
}

function HandlePill({ status }: { status: HandleStatus }) {
  if (status === "available") {
    return (
      <View style={[styles.pill, styles.pillAvailable]}>
        <Text style={styles.pillTextAvailable}>available</Text>
      </View>
    );
  }
  if (status === "taken") {
    return (
      <View style={[styles.pill, styles.pillTaken]}>
        <Text style={styles.pillTextTaken}>taken</Text>
      </View>
    );
  }
  return null;
}

/**
 * Google's own branding guidelines for "Sign in with Google" — white surface,
 * a hairline border rather than a filled pill, and the logomark unmodified —
 * so this deliberately breaks from the app's own Btn styling instead of
 * reusing it.
 */
function GoogleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled }}
      scaleTo={0.97}
      style={[styles.googleBtn, disabled && { opacity: 0.5 }]}
    >
      <GoogleIcon size={18} />
      <Text style={styles.googleLabel}>Continue with Google</Text>
    </AnimatedPressable>
  );
}

/** A centered, single-button confirmation — deliberately not the app's
 * bottom Sheet, matching the design's plain alert-style dialog. */
function ForgotPasswordAlert({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.alertLayer}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>Check your email</Text>
          <Text style={styles.alertBody}>
            If an account matches, a link to reset your password is on its way.
          </Text>
          <Btn label="OK" variant="ink" wide onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/* ── Login ────────────────────────────────────────────────────────────────── */

function LoginScreen({
  identifier,
  setIdentifier,
  password,
  setPassword,
  busy,
  error,
  notice,
  canSubmit,
  onSubmit,
  onGoogle,
  onForgotPassword,
  onCreateAccount,
}: {
  identifier: string;
  setIdentifier: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  busy: boolean;
  error: string | null;
  notice: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
  onGoogle: () => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
}) {
  return (
    <>
      <Text style={styles.wordmark}>pnyx</Text>
      <Text style={styles.tagline}>Everyone should know what everyone really thinks.</Text>

      <FieldGroup>
        <GroupRow first>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Email or handle"
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Email or handle"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.rowInput}
          />
        </GroupRow>
        <PasswordRow value={password} onChangeText={setPassword} placeholder="Password" />
      </FieldGroup>

      <Pressable onPress={onForgotPassword} accessibilityRole="button" style={styles.forgot}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <Btn label={busy ? "Working…" : "Log in"} variant="ink" wide disabled={!canSubmit} onPress={onSubmit} />

      <View style={styles.divider}>
        <View style={styles.rule} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.rule} />
      </View>

      <GoogleButton disabled={busy} onPress={onGoogle} />
      <Text style={styles.host}>{API_URL}</Text>

      <View style={{ flex: 1 }} />

      <Pressable onPress={onCreateAccount} accessibilityRole="button" style={styles.switchRow}>
        <Text style={styles.switchText}>
          New to Pnyx? <Text style={styles.switchLink}>Create account</Text>
        </Text>
      </Pressable>
    </>
  );
}

/* ── Create account ───────────────────────────────────────────────────────── */

function CreateAccountScreen({
  name,
  setName,
  handle,
  setHandle,
  handleStatus,
  email,
  setEmail,
  password,
  setPassword,
  day,
  setDay,
  month,
  setMonth,
  year,
  setYear,
  dateInvalid,
  busy,
  error,
  notice,
  canSubmit,
  onSubmit,
  onBack,
  onLogin,
}: {
  name: string;
  setName: (v: string) => void;
  handle: string;
  setHandle: (v: string) => void;
  handleStatus: HandleStatus;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  day: string;
  setDay: (v: string) => void;
  month: string;
  setMonth: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  dateInvalid: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
  onBack: () => void;
  onLogin: () => void;
}) {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // Some host environments (the RN test renderer among them) don't implement the
  // imperative handle — auto-advance is a nicety, so a missing focus() is a no-op.
  const focusNext = (ref: RefObject<TextInput | null>) => () => {
    try {
      ref.current?.focus();
    } catch {
      // ignore
    }
  };

  return (
    <>
      <AnimatedPressable
        onPress={onBack}
        hitSlop={8}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backBtn}
      >
        <Icon name="back" size={18} color={c.text} />
      </AnimatedPressable>

      <Text style={styles.heading}>Create your page.</Text>
      <Text style={styles.subheading}>
        Every vote places you on five grids. Your type unlocks after fifty reactions.
      </Text>

      <FieldGroup>
        <GroupRow first>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Name"
            style={styles.rowInput}
          />
        </GroupRow>
        <GroupRow>
          <Text style={styles.at}>@</Text>
          <TextInput
            value={handle}
            onChangeText={setHandle}
            placeholder="handle"
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Handle"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            style={styles.rowInput}
          />
          <HandlePill status={handleStatus} />
        </GroupRow>
        <GroupRow>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.rowInput}
          />
        </GroupRow>
        <PasswordRow value={password} onChangeText={setPassword} placeholder="Password" />
      </FieldGroup>

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
        {dateInvalid && <Text style={styles.error}>Enter a valid birth date.</Text>}
        <Text style={styles.hint}>You must be {MIN_AGE} or older to use PNYX.</Text>
      </View>

      {handleStatus === "taken" && (
        <Text style={styles.error}>@{handle.trim()} is taken. Try another handle.</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <Btn
        label={busy ? "Working…" : "Create account"}
        variant="ink"
        wide
        disabled={!canSubmit}
        onPress={onSubmit}
      />
      <Text style={styles.terms}>
        By creating an account you agree to the{" "}
        <Text
          style={styles.termsLink}
          accessibilityRole="link"
          onPress={() => TERMS_URL && void WebBrowser.openBrowserAsync(TERMS_URL)}
        >
          Terms
        </Text>
        . Opinions only.
      </Text>

      <View style={{ flex: 1 }} />

      <Pressable onPress={onLogin} accessibilityRole="button" style={styles.switchRow}>
        <Text style={styles.switchText}>
          Have an account? <Text style={styles.switchLink}>Log in</Text>
        </Text>
      </Pressable>
    </>
  );
}

/* ── Container ────────────────────────────────────────────────────────────── */

export function SignIn() {
  const { signIn, signUp, signInWithGoogle, handleAvailable, forgotPassword, configured } = useSession();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [tooYoung, setTooYoung] = useState(false);

  const birth = toBirthDate(day, month, year);
  const dateStarted = day.length > 0 || month.length > 0 || year.length > 0;
  const dateInvalid = dateStarted && day.length > 0 && month.length > 0 && year.length === 4 && !birth;

  // Debounced, race-safe live handle-availability check for the create-account screen.
  const handleCheckSeq = useRef(0);
  useEffect(() => {
    const trimmed = handle.trim();
    if (!HANDLE_RE.test(trimmed) || trimmed.length < 2) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    const seq = ++handleCheckSeq.current;
    const timer = setTimeout(() => {
      handleAvailable(trimmed)
        .then((available) => {
          if (handleCheckSeq.current === seq) setHandleStatus(available ? "available" : "taken");
        })
        .catch(() => {
          if (handleCheckSeq.current === seq) setHandleStatus("idle");
        });
    }, HANDLE_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [handle, handleAvailable]);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (mode === "up") {
      if (!birth) return;
      if (ageOn(birth) < MIN_AGE) {
        setTooYoung(true);
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "in") {
        await signIn(identifier, password);
      } else {
        const res = await signUp(identifier, password, toISODate(birth!), name, handle);
        if (res.pending) setNotice(res.message ?? "Check your email to confirm the account.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await signInWithGoogle();
      if (res.cancelled) setNotice("Google sign-in was cancelled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const onForgotPassword = async () => {
    // Nothing to check without at least a couple of characters — bail out
    // rather than showing "check your email" for a request that was never
    // sent (a real false-positive, unlike the deliberate non-revealing
    // response the backend itself always gives once a request IS sent).
    if (identifier.trim().length < 2) return;
    try {
      await forgotPassword(identifier);
    } catch {
      // Deliberately swallowed — the alert always shows the same message
      // regardless of outcome, matching the backend's own non-revealing
      // response.
    }
    setForgotOpen(true);
  };

  const switchTo = (next: "in" | "up") => {
    setError(null);
    setNotice(null);
    setTooYoung(false);
    setMode(next);
  };

  const canSubmit =
    mode === "in"
      ? identifier.trim().length >= 2 && password.length >= 8 && !busy
      : identifier.trim().length > 3 &&
        password.length >= 8 &&
        handleStatus === "available" &&
        Boolean(birth) &&
        !busy;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + s[7], paddingBottom: insets.bottom + s[5] }]}
        keyboardShouldPersistTaps="handled"
      >
        {!configured ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              No API configured. Set EXPO_PUBLIC_API_URL in .env and restart Expo to sign in.
            </Text>
          </View>
        ) : tooYoung ? (
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>You need to be {MIN_AGE} or older</Text>
            <Text style={styles.blockBody}>
              PNYX isn&apos;t available to people under {MIN_AGE}. If you entered your birthday by
              mistake, you can go back and try again.
            </Text>
            <Btn label="Go back" onPress={() => setTooYoung(false)} wide />
          </View>
        ) : mode === "in" ? (
          <LoginScreen
            identifier={identifier}
            setIdentifier={setIdentifier}
            password={password}
            setPassword={setPassword}
            busy={busy}
            error={error}
            notice={notice}
            canSubmit={canSubmit}
            onSubmit={() => void submit()}
            onGoogle={() => void google()}
            onForgotPassword={() => void onForgotPassword()}
            onCreateAccount={() => switchTo("up")}
          />
        ) : (
          <CreateAccountScreen
            name={name}
            setName={setName}
            handle={handle}
            setHandle={setHandle}
            handleStatus={handleStatus}
            email={identifier}
            setEmail={setIdentifier}
            password={password}
            setPassword={setPassword}
            day={day}
            setDay={setDay}
            month={month}
            setMonth={setMonth}
            year={year}
            setYear={setYear}
            dateInvalid={dateInvalid}
            busy={busy}
            error={error}
            notice={notice}
            canSubmit={canSubmit}
            onSubmit={() => void submit()}
            onBack={() => switchTo("in")}
            onLogin={() => switchTo("in")}
          />
        )}
      </ScrollView>

      <ForgotPasswordAlert visible={forgotOpen} onClose={() => setForgotOpen(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { flexGrow: 1, padding: s[5], gap: s[3] },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: r.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
    marginBottom: s[2],
    ...squircle,
  },

  wordmark: { color: c.text, fontSize: 28, fontFamily: display.bold },
  tagline: { color: c.text, fontSize: f.lg, lineHeight: 24, marginBottom: s[3], maxWidth: 320 },
  heading: { color: c.text, fontSize: f.xl, fontFamily: display.bold },
  subheading: { color: c.textDim, fontSize: f.sm, lineHeight: 19, marginBottom: s[3], maxWidth: 340 },

  group: {
    backgroundColor: c.surface2,
    borderRadius: r.md,
    overflow: "hidden",
    ...squircle,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[2],
    paddingHorizontal: s[4],
    paddingVertical: 12,
    minHeight: 50,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.line },
  rowInput: { flex: 1, color: c.text, fontSize: f.md, padding: 0 },
  at: { color: c.textFaint, fontSize: f.md },

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

  pill: { paddingHorizontal: s[2], paddingVertical: 4, borderRadius: r.full },
  pillAvailable: { backgroundColor: c.text },
  pillTextAvailable: { color: c.onAccent, fontSize: f.xs, fontWeight: "600" },
  pillTaken: { backgroundColor: c.surface3 },
  pillTextTaken: { color: c.textDim, fontSize: f.xs, fontWeight: "600" },

  forgot: { alignSelf: "flex-end" },
  forgotText: { color: c.textDim, fontSize: f.xs, textDecorationLine: "underline" },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s[2],
    minHeight: 50,
    paddingHorizontal: s[4],
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: "#747775",
    backgroundColor: "#fff",
    ...squircle,
  },
  googleLabel: { color: "#1f1f1f", fontSize: f.sm, fontWeight: "500" },

  divider: { flexDirection: "row", alignItems: "center", gap: s[3], marginVertical: s[1] },
  rule: { flex: 1, height: 1, backgroundColor: c.line },
  dividerText: { color: c.textFaint, fontSize: f.xs },

  error: { color: c.down, fontSize: f.sm },
  notice: { color: c.up, fontSize: f.sm },
  host: { color: c.textFaint, fontSize: f.xs, textAlign: "center", marginTop: s[2] },

  terms: { color: c.textFaint, fontSize: f.xs, lineHeight: 16 },
  termsLink: { textDecorationLine: "underline", color: c.textDim },

  switchRow: { alignItems: "center", paddingTop: s[4] },
  switchText: { color: c.textFaint, fontSize: f.sm },
  switchLink: { color: c.text, fontWeight: "700" },

  warn: {
    padding: s[4],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: r.md,
  },
  warnText: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },

  alertLayer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.overlay, padding: s[5] },
  alertCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: c.surface,
    borderRadius: r.lg,
    padding: s[4],
    gap: s[3],
    ...squircle,
  },
  alertTitle: { color: c.text, fontSize: f.md, fontFamily: display.semibold, textAlign: "center" },
  alertBody: { color: c.textDim, fontSize: f.sm, lineHeight: 19, textAlign: "center" },

  blockCard: {
    marginTop: s[5],
    padding: s[5],
    gap: s[3],
    borderRadius: r.lg,
    backgroundColor: c.surface,
    ...squircle,
  },
  blockTitle: { color: c.text, fontSize: f.lg, fontFamily: display.bold },
  blockBody: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
});
