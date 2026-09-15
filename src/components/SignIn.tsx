import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "./AnimatedPressable";
import { GoogleIcon } from "./GoogleIcon";
import { Btn } from "./Primitives";
import { Sheet } from "./Sheet";
import { API_URL } from "@/api/client";
import { useSession } from "@/state/session";
import { c, display, f, r, s, squircle } from "@/theme/tokens";

function ForgotPasswordSheet({ open, onClose, initialEmail }: { open: boolean; onClose: () => void; initialEmail: string }) {
  const { forgotPassword } = useSession();
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    onClose();
    // Reset for next time, after the close animation would have finished reading it.
    setTimeout(() => setSent(false), 300);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Reset your password" onClose={close}>
      {sent ? (
        <View style={{ gap: s[3] }}>
          <Text style={styles.sheetBody}>
            If an account exists for {email.trim()}, a reset link is on its way. Open it on this device to set a new
            password.
          </Text>
          <Btn label="Done" onPress={close} wide />
        </View>
      ) : (
        <View style={{ gap: s[3] }}>
          <Text style={styles.sheetBody}>We&apos;ll email a link to set a new password.</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          <Btn
            label={busy ? "Sending…" : "Send reset link"}
            variant="accent"
            wide
            disabled={busy || email.trim().length < 4}
            onPress={() => void submit()}
          />
        </View>
      )}
    </Sheet>
  );
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

export function SignIn({ onSkip }: { onSkip?: () => void }) {
  const { signIn, signUp, signInWithGoogle, configured } = useSession();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "in") {
        await signIn(email, password);
      } else {
        const res = await signUp(email, password, name);
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

  const canSubmit = email.trim().length > 3 && password.length >= 8 && !busy;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + s[7] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.wordmark}>PNYX</Text>
        <Text style={styles.tagline}>Everyone should know what everyone really thinks.</Text>

        {!configured ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              No API configured. Set EXPO_PUBLIC_API_URL in .env and restart Expo to sign in.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.switcher}>
              {(
                [
                  ["in", "Sign in"],
                  ["up", "Create account"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setMode(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === key }}
                  style={[styles.switchBtn, mode === key && styles.switchBtnOn]}
                >
                  <Text style={[styles.switchLabel, mode === key && { color: c.text }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {mode === "up" && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={c.textFaint}
                accessibilityLabel="Your name"
                style={styles.input}
              />
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={c.textFaint}
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (at least 8 characters)"
              placeholderTextColor={c.textFaint}
              accessibilityLabel="Password"
              autoCapitalize="none"
              secureTextEntry
              style={styles.input}
            />

            {mode === "in" && (
              <Pressable onPress={() => setForgotOpen(true)} accessibilityRole="button" style={styles.forgot}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
            {notice && <Text style={styles.notice}>{notice}</Text>}

            <Btn
              label={busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
              variant="accent"
              wide
              disabled={!canSubmit}
              onPress={() => void submit()}
            />

            <View style={styles.divider}>
              <View style={styles.rule} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.rule} />
            </View>

            <GoogleButton disabled={busy} onPress={() => void google()} />
            <Text style={styles.host}>{API_URL}</Text>
          </>
        )}

        {onSkip && (
          <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>Explore the sample profile without an account</Text>
          </Pressable>
        )}
      </ScrollView>

      <ForgotPasswordSheet open={forgotOpen} onClose={() => setForgotOpen(false)} initialEmail={email} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[5], paddingBottom: s[7], gap: s[3] },
  wordmark: { color: c.text, fontSize: 24, fontFamily: display.bold, letterSpacing: 6 },
  tagline: { color: c.textDim, fontSize: f.md, lineHeight: 22, marginBottom: s[5], maxWidth: 300 },
  switcher: { flexDirection: "row", gap: s[1], marginBottom: s[2] },
  switchBtn: { paddingVertical: s[2], paddingHorizontal: s[3], borderRadius: r.full },
  switchBtnOn: { backgroundColor: c.surface2 },
  switchLabel: { color: c.textFaint, fontSize: f.sm, fontWeight: "500" },
  input: {
    color: c.text,
    fontSize: f.md,
    paddingHorizontal: s[3],
    paddingVertical: 12,
    borderRadius: r.sm,
    backgroundColor: c.surface2,
    ...squircle,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s[2],
    minHeight: 44,
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
  forgot: { alignSelf: "flex-end" },
  forgotText: { color: c.textDim, fontSize: f.xs, textDecorationLine: "underline" },
  sheetBody: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
  host: { color: c.textFaint, fontSize: f.xs, textAlign: "center", marginTop: s[2] },
  warn: {
    padding: s[4],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: r.md,
  },
  warnText: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  skip: { marginTop: s[5], alignItems: "center" },
  skipText: { color: c.textFaint, fontSize: f.sm, textDecorationLine: "underline" },
});
