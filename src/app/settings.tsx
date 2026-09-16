import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { identityCode } from "@/lib/algorithm";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Chrome";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/Icon";
import { Btn, Card, Field, SectionTitle, Toggle } from "@/components/Primitives";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { GRID_LIST } from "@/lib/grids";
import type { PrivacyTier } from "@/lib/types";
import { useSession } from "@/state/session";
import { useStore } from "@/state/store";
import type { Profile } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";

const TIERS: { id: PrivacyTier; label: string; note: string }[] = [
  { id: "speaker", label: "Speaker", note: "Most public. Your loved and hated takes are visible, and you can post. Can be changed once a month." },
  { id: "active", label: "Active", note: "Profile and three grids visible to everyone." },
  { id: "private", label: "Private", note: "Grids hidden. You still get alignment scores." },
];

type TextKey = "name" | "handle" | "pronouns";

const FIELDS: { key: TextKey; label: string; prefix?: string }[] = [
  { key: "name", label: "Name" },
  { key: "handle", label: "Handle", prefix: "@" },
  { key: "pronouns", label: "Pronouns" },
];

const PILL_SPRING = { damping: 22, stiffness: 260, mass: 0.7 } as const;
const PILL_INSET = 3;

/** The active-tier highlight slides between positions instead of the old
 * instant background swap — same motion language as the tab bar's own
 * sliding indicator, reused here because both are "which one is active"
 * segmented controls. */
function PillHighlight({ index, count, trackWidth }: { index: number; count: number; trackWidth: number }) {
  const segment = trackWidth / count;
  const translateX = useSharedValue(segment * index);
  const width = useSharedValue(Math.max(segment - PILL_INSET * 2, 0));

  useEffect(() => {
    if (trackWidth <= 0) return;
    translateX.value = withSpring(segment * index + PILL_INSET, PILL_SPRING);
    width.value = withSpring(Math.max(segment - PILL_INSET * 2, 0), PILL_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, trackWidth]);

  const style = useAnimatedStyle(() => ({
    position: "absolute" as const,
    top: PILL_INSET,
    bottom: PILL_INSET,
    left: 0,
    width: width.value,
    transform: [{ translateX: translateX.value }],
  }));

  if (trackWidth <= 0) return null;
  return <Animated.View style={[style, styles.pillHighlight]} />;
}

const NOTIF_ROWS: { key: "votes" | "replies" | "alignments"; label: string }[] = [
  { key: "votes", label: "Votes on your takes" },
  { key: "replies", label: "Replies" },
  { key: "alignments", label: "New alignments" },
];

/** A label-left, value-right row that still edits inline — no visible input
 * chrome, so it reads as plain text until you tap it, matching the handoff. */
function InfoRow({
  label,
  value,
  onChangeText,
  last = false,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  last?: boolean;
  readOnly?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {readOnly ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          style={styles.rowInput}
          textAlign="right"
          placeholderTextColor={c.textFaint}
        />
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { state, dispatch, positions, saveProfile, saveNotifPrefs, saveAvatar, forgetMe, mode } = useStore();
  const { signOut, changePassword, hasPassword: fetchHasPassword } = useSession();
  const toast = useToast();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [about, setAbout] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pillTrackWidth, setPillTrackWidth] = useState(0);
  const onPillTrackLayout = (e: LayoutChangeEvent) => setPillTrackWidth(e.nativeEvent.layout.width);

  // Null while unknown — a Google-only account has no password to change,
  // so the button/sheet need to know which form to show before they render.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  useEffect(() => {
    if (mode !== "remote") return;
    let alive = true;
    fetchHasPassword().then((v) => {
      if (alive) setHasPassword(v);
    });
    return () => {
      alive = false;
    };
  }, [mode, fetchHasPassword]);

  const leave = async () => {
    await signOut();
    // Drop this account's cached votes and profile so the next sign-in does not
    // briefly render the last one's data.
    dispatch({ type: "forget" });
    toast("Signed out.");
  };

  const setField = (key: TextKey, value: string) => {
    const patch: Partial<Profile> = {};
    patch[key] = value;
    void saveProfile(patch);
  };

  const wipe = async () => {
    await forgetMe();
    setConfirmWipe(false);
    toast("Everything erased. You're back at zero.");
  };

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast("PNYX needs access to your library to set a photo");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      await saveAvatar(asset.uri, asset.mimeType ?? "image/jpeg");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't set that photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const tier = TIERS.find((t) => t.id === state.profile.tier)!;

  return (
    <View style={styles.screen}>
      <PageHeader title="Settings" centered />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AnimatedPressable
          onPress={() => void pickAvatar()}
          scaleTo={0.95}
          style={styles.avatarRow}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          disabled={uploadingAvatar}
        >
          <View style={styles.avatarWrap}>
            <Avatar name={state.profile.name} positions={positions} size={64} photoUrl={state.profile.avatarUrl} />
            <View style={styles.avatarEditBadge}>
              <Icon name="plus" size={12} color={c.app} />
            </View>
          </View>
          <Text style={styles.avatarLabel}>{uploadingAvatar ? "Uploading…" : "Change photo"}</Text>
        </AnimatedPressable>

        <View>
          <SectionTitle style={styles.plainTitle}>Account</SectionTitle>
          <View style={styles.card}>
            {FIELDS.map((field) => (
              <InfoRow
                key={field.key}
                label={field.label}
                value={field.prefix ? `${field.prefix}${state.profile[field.key]}` : state.profile[field.key]}
                onChangeText={(v) => setField(field.key, field.prefix ? v.replace(field.prefix, "") : v)}
              />
            ))}
            <InfoRow label="Code" value={identityCode(positions)} readOnly last />
          </View>
        </View>

        <Card>
          <Field label="Bio" value={state.profile.bio} onChangeText={(v) => void saveProfile({ bio: v })} multiline />
        </Card>

        <View>
          <SectionTitle style={styles.plainTitle}>Visibility</SectionTitle>
          <View style={styles.pillTrack} onLayout={onPillTrackLayout}>
            <PillHighlight
              index={TIERS.findIndex((t) => t.id === state.profile.tier)}
              count={TIERS.length}
              trackWidth={pillTrackWidth}
            />
            {TIERS.map((t) => {
              const active = t.id === state.profile.tier;
              return (
                <AnimatedPressable
                  key={t.id}
                  onPress={() => void saveProfile({ tier: t.id })}
                  scaleTo={0.97}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={styles.pill}
                >
                  <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{t.label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Text style={styles.note}>{tier.note}</Text>
        </View>

        <View>
          <SectionTitle style={styles.plainTitle}>Notifications</SectionTitle>
          <View style={styles.card}>
            {NOTIF_ROWS.map((row, i) => (
              <View key={row.key} style={[styles.toggleRow, i !== NOTIF_ROWS.length - 1 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Toggle
                  value={state.notifPrefs[row.key]}
                  onValueChange={(v) => void saveNotifPrefs({ [row.key]: v })}
                  label={row.label}
                />
              </View>
            ))}
          </View>
        </View>

        <View>
          <SectionTitle style={styles.plainTitle}>Public alignment</SectionTitle>
          <View style={styles.card}>
            {GRID_LIST.map((grid, i) => (
              <View key={grid.id} style={[styles.toggleRow, i !== GRID_LIST.length - 1 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{grid.label}</Text>
                <Toggle
                  value={state.gridPublic[grid.id]}
                  onValueChange={(v) => dispatch({ type: "gridPublic", grid: grid.id, value: v })}
                  label={`${grid.label} alignment public`}
                />
              </View>
            ))}
          </View>
        </View>

        <Card>
          <SectionTitle>Session</SectionTitle>
          <Text style={styles.note}>
            {mode === "remote"
              ? `Signed in as @${state.profile.handle}. Signing out leaves your data on the server.`
              : "Exploring without an account — signing out clears your profile from this device."}
          </Text>
          <View style={{ flexDirection: "row", gap: s[2] }}>
            {mode === "remote" && (
              <Btn
                label={hasPassword === false ? "Set password" : "Change password"}
                variant="outline"
                onPress={() => setChangingPassword(true)}
                style={{ flex: 1 }}
              />
            )}
            <Btn label="Log out" onPress={() => void leave()} style={{ flex: 1 }} />
          </View>
        </Card>

        <View>
          <SectionTitle style={styles.plainTitle}>Privacy</SectionTitle>
          <AnimatedPressable style={styles.card} scaleTo={0.99} onPress={() => setConfirmWipe(true)}>
            <Text style={styles.forgetLabel}>Forget me</Text>
          </AnimatedPressable>
          <Text style={styles.note}>Wipes your votes, positions, takes and messages from Pnyx.</Text>
        </View>

        <View>
          <SectionTitle style={styles.plainTitle}>About</SectionTitle>
          <AnimatedPressable style={styles.card} scaleTo={0.99} onPress={() => setAbout(true)}>
            <Text style={styles.rowLabel}>Terms and moderation</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>

      <Sheet open={confirmWipe} title="Erase everything?" onClose={() => setConfirmWipe(false)}>
        <Text style={styles.sheetLead}>
          Your {state.votes.length} recorded reactions and all five grid positions will be deleted immediately.
        </Text>
        <View style={styles.sheetActions}>
          <Btn label="Keep my data" variant="outline" onPress={() => setConfirmWipe(false)} style={{ flex: 1 }} />
          <Btn label="Erase everything" variant="danger" onPress={() => void wipe()} style={{ flex: 1 }} />
        </View>
      </Sheet>

      <Sheet open={about} title="Terms and moderation" onClose={() => setAbout(false)}>
        <Text style={styles.sheetLead}>
          Everything you publish is scored on the same five grids your own position sits on. Posts go through
          moderation and the terms of service before they reach anyone&apos;s feed.
        </Text>
      </Sheet>

      <ChangePasswordSheet
        open={changingPassword}
        onClose={() => setChangingPassword(false)}
        changePassword={changePassword}
        hasPassword={hasPassword !== false}
      />
    </View>
  );
}

function ChangePasswordSheet({
  open,
  onClose,
  changePassword,
  hasPassword,
}: {
  open: boolean;
  onClose: () => void;
  changePassword: (current: string | undefined, next: string) => Promise<void>;
  /** False for a Google-only account — no "current password" field, nothing to verify. */
  hasPassword: boolean;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const submit = async () => {
    if (next.length < 8) {
      toast("New password needs at least 8 characters");
      return;
    }
    if (next !== confirm) {
      toast("New passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await changePassword(hasPassword ? current : undefined, next);
      toast(hasPassword ? "Password changed." : "Password set. You can now also sign in with email and password.");
      reset();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      title={hasPassword ? "Change password" : "Set a password"}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <View style={{ gap: s[3] }}>
        {!hasPassword && (
          <Text style={styles.note}>
            Your account was created with Google and has no password yet — set one to also be able to sign in with
            email and password.
          </Text>
        )}
        {hasPassword && <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />}
        <Field label="New password" value={next} onChangeText={setNext} placeholder="At least 8 characters" secureTextEntry />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <Btn
          label={busy ? (hasPassword ? "Changing…" : "Setting…") : hasPassword ? "Change password" : "Set password"}
          onPress={() => void submit()}
          disabled={busy}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7], gap: s[5] },
  avatarRow: { alignItems: "center", gap: s[2] },
  avatarWrap: { width: 64, height: 64 },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.text,
    borderWidth: 2,
    borderColor: c.app,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { color: c.textDim, fontSize: f.sm, fontWeight: "600" },
  plainTitle: {
    color: c.textFaint,
    fontSize: f.sm,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "none",
    marginBottom: s[2],
  },
  card: {
    borderRadius: r.lg,
    backgroundColor: c.surface,
    paddingHorizontal: s[4],
    ...squircle,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: s[3], gap: s[3] },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.lineSoft },
  rowLabel: { color: c.text, fontSize: f.sm, fontWeight: "500" },
  rowValue: { color: c.textFaint, fontSize: f.sm, flex: 1, textAlign: "right" },
  rowInput: { color: c.textFaint, fontSize: f.sm, flex: 1, paddingVertical: 0 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: s[3] },
  note: { color: c.textFaint, fontSize: f.xs, lineHeight: 17, marginTop: s[2], paddingHorizontal: 2 },
  pillTrack: {
    flexDirection: "row",
    backgroundColor: c.surface2,
    borderRadius: r.full,
    padding: 3,
    gap: 3,
    ...squircle,
  },
  pill: {
    flex: 1,
    height: 34,
    borderRadius: r.full,
    alignItems: "center",
    justifyContent: "center",
    ...squircle,
  },
  pillHighlight: {
    backgroundColor: c.surface,
    borderRadius: r.full,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    ...squircle,
  },
  pillLabel: { color: c.textDim, fontSize: f.sm, fontWeight: "600" },
  pillLabelActive: { color: c.text },
  forgetLabel: { color: c.down, fontSize: f.sm, fontWeight: "600", paddingVertical: s[3] },
  sheetLead: { color: c.textDim, fontSize: f.sm, marginBottom: s[4], lineHeight: 20 },
  sheetActions: { flexDirection: "row", gap: s[2] },
});
