import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRecoveryRedirect } from "@/api/oauth";
import { Btn } from "@/components/Primitives";
import { useSession } from "@/state/session";
import { c, display, f, r, s, squircle } from "@/theme/tokens";

/**
 * Where a password-recovery email link lands — opened straight from the
 * device's mail app, potentially with the JS runtime cold-started, so unlike
 * the Google sign-in flow (swallowed entirely by openAuthSessionAsync before
 * it ever becomes a real deep link) this has to be a real route. AuthGate
 * knows to never cover this one with the sign-in screen, since reaching it
 * while signed out is the whole point.
 */
export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const { completePasswordReset } = useSession();
  const insets = useSafeAreaInsets();

  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isRecovery = url ? isRecoveryRedirect(url) : null;

  useEffect(() => {
    // Anything else landing here isn't a recovery link — the app has no
    // other reason to open this route, so there's nothing useful to show.
    if (isRecovery === false) router.replace("/");
  }, [isRecovery, router]);

  if (isRecovery === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={c.textFaint} />
      </View>
    );
  }
  if (!isRecovery) return null;

  const canSubmit = next.length >= 8 && next === confirm && !busy;

  const submit = async () => {
    if (!url) return;
    setError(null);
    setBusy(true);
    try {
      await completePasswordReset(url, next);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset your password");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.wordmark}>PNYX</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Password set</Text>
          <Text style={styles.cardBody}>You&apos;re signed in with your new password.</Text>
          <Btn label="Continue" variant="accent" wide onPress={() => router.replace("/")} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.content, { paddingTop: insets.top + s[7] }]}>
        <Text style={styles.wordmark}>PNYX</Text>
        <Text style={styles.tagline}>Set a new password.</Text>

        <TextInput
          value={next}
          onChangeText={setNext}
          placeholder="New password (at least 8 characters)"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="New password"
          autoCapitalize="none"
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm new password"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Confirm new password"
          autoCapitalize="none"
          secureTextEntry
          style={styles.input}
        />
        {next.length > 0 && confirm.length > 0 && next !== confirm && (
          <Text style={styles.error}>Passwords don&apos;t match.</Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}

        <Btn
          label={busy ? "Setting…" : "Set password"}
          variant="accent"
          wide
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: s[5] },
  content: { flex: 1, padding: s[5], gap: s[3] },
  wordmark: { color: c.text, fontSize: 24, fontFamily: display.bold, letterSpacing: 6 },
  tagline: { color: c.textDim, fontSize: f.md, lineHeight: 22, marginBottom: s[3] },
  input: {
    color: c.text,
    fontSize: f.md,
    paddingHorizontal: s[3],
    paddingVertical: 12,
    borderRadius: r.sm,
    backgroundColor: c.surface2,
    ...squircle,
  },
  error: { color: c.down, fontSize: f.sm },
  card: {
    width: "100%",
    marginTop: s[5],
    padding: s[5],
    gap: s[3],
    borderRadius: r.lg,
    backgroundColor: c.surface,
    ...squircle,
  },
  cardTitle: { color: c.text, fontSize: f.lg, fontFamily: display.bold },
  cardBody: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
});
