import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { identityCode } from "@/lib/algorithm";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Chrome";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/Icon";
import { FORM_KEYBOARD_BEHAVIOR, FORM_SCROLL_PROPS } from "@/components/keyboard";
import { LoadingMark } from "@/components/Loading";
import { Btn, Field, SectionTitle, Toggle } from "@/components/Primitives";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ApiError, DMCA_URL, EULA_URL, PRIVACY_URL, TERMS_URL } from "@/api/client";
import { GRID_LIST } from "@/lib/grids";
import type { GridId, PrivacyTier } from "@/lib/types";
import { useSession } from "@/state/session";
import { useStore } from "@/state/store";
import type { SettingsPatch } from "@/state/store";
import { c, f, hexToRgba, r, s, squircle } from "@/theme/tokens";

const TIERS: { id: PrivacyTier; label: string; note: string }[] = [
  { id: "speaker", label: "Speaker", note: "Most public. Your loved and hated takes are visible, and you can post." },
  { id: "active", label: "Active", note: "Profile and three grids visible to everyone." },
  { id: "private", label: "Private", note: "Grids hidden. You still get alignment scores." },
];

/** Mirrors pnyx-backend's TIER_CHANGE_COOLDOWN_MS — the server is what
 * enforces it; this only lets the page say so before anyone hits the wall. */
const TIER_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatDay = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "long", day: "numeric" });

/** Everything the save button covers. The photo and password save on their
 * own, since each is already its own deliberate action. */
type Draft = Required<Omit<SettingsPatch, "notifPrefs" | "gridPublic">> & {
  notifPrefs: NonNullable<SettingsPatch["notifPrefs"]>;
  gridPublic: Record<GridId, boolean>;
};

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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

/**
 * Every section on this page is the same grouped list: a heading above, one
 * card of evenly padded rows, and any explanation as a note below the card —
 * never a second card style or a heading inside the card.
 */
function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View>
      <SectionTitle style={styles.groupTitle}>{title}</SectionTitle>
      <View style={styles.card}>{children}</View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

/** A tappable row. `chevron` for rows that open something (a sheet); plain
 * actions (log out, forget me) have none. */
function ActionRow({
  label,
  onPress,
  chevron = false,
  destructive = false,
  last = false,
}: {
  label: string;
  onPress: () => void;
  chevron?: boolean;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      style={[styles.row, !last && styles.rowDivider]}
    >
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {chevron && <Icon name="chevron" size={16} color={c.textDim} strokeWidth={2} />}
    </AnimatedPressable>
  );
}

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
  const { state, dispatch, positions, saveSettings, saveAvatar, forgetMe, mode } = useStore();
  const { signOut, changePassword, hasPassword: fetchHasPassword } = useSession();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmTier, setConfirmTier] = useState(false);
  const [saving, setSaving] = useState(false);

  // Only what's been touched, laid over the saved values — so a /me that lands
  // after the page opened still shows through for everything else.
  const saved: Draft = {
    name: state.profile.name,
    handle: state.profile.handle,
    pronouns: state.profile.pronouns,
    bio: state.profile.bio,
    tier: state.profile.tier,
    notifPrefs: state.notifPrefs,
    gridPublic: state.gridPublic,
  };
  const [edits, setEdits] = useState<Partial<Draft>>({});
  const draft: Draft = { ...saved, ...edits };
  const edit = <K extends keyof Draft>(key: K, value: Draft[K]) => setEdits((e) => ({ ...e, [key]: value }));
  const patch = Object.fromEntries(
    Object.entries(edits).filter(([key, value]) => !sameValue(value, saved[key as keyof Draft])),
  ) as SettingsPatch;
  const changeCount = Object.keys(patch).length;
  const dirty = changeCount > 0;

  const tierChangedAt = state.profile.tierChangedAt ? Date.parse(state.profile.tierChangedAt) : null;
  const tierUnlocksAt = tierChangedAt === null ? null : tierChangedAt + TIER_COOLDOWN_DAYS * DAY_MS;
  // Day-granular dates, so the moment the page opened is close enough for "now".
  const [openedAt] = useState(Date.now);
  const tierExempt = state.profile.tierCooldownExempt === true;
  const tierLocked = !tierExempt && tierUnlocksAt !== null && tierUnlocksAt > openedAt;
  const nextLockEnds = formatDay(openedAt + TIER_COOLDOWN_DAYS * DAY_MS);
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
    // Settings is a stack screen pushed on top of the tabs — it doesn't
    // unmount just because AuthGate covers it, so without this the next
    // sign-in would land right back here instead of on the default tab.
    router.replace("/");
    toast("Signed out.");
  };

  const commit = async () => {
    setConfirmTier(false);
    setSaving(true);
    try {
      await saveSettings(patch);
      setEdits({});
      toast("Settings saved.");
    } catch (e) {
      const nextChangeAt = e instanceof ApiError && e.status === 429 ? e.details?.nextChangeAt : undefined;
      if (typeof nextChangeAt === "string") {
        // The server rejects the whole PATCH, so drop just the tier and let
        // the rest go through on the next tap.
        setEdits(({ tier: _tier, ...rest }) => rest);
        toast(
          `Visibility is locked until ${formatDay(Date.parse(nextChangeAt))}. Nothing was saved — tap Save again for your other changes.`,
        );
      } else {
        toast(e instanceof Error ? e.message : "Couldn't save your settings");
      }
    } finally {
      setSaving(false);
    }
  };

  // A tier change starts a 30-day lock, so it gets a second look first.
  const save = () => (patch.tier !== undefined && !tierExempt ? setConfirmTier(true) : void commit());

  const wipe = async () => {
    await forgetMe();
    // The account is gone — staying signed in to it would leave a session
    // pointing at nothing.
    await signOut();
    setConfirmWipe(false);
    router.replace("/");
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

  const tier = TIERS.find((t) => t.id === draft.tier)!;
  const savedTier = TIERS.find((t) => t.id === saved.tier)!;
  const tierRule = tierExempt
    ? "This account can change visibility anytime — no 30-day lock."
    : tierLocked
      ? `Locked until ${formatDay(tierUnlocksAt!)}. Visibility can only change once every ${TIER_COOLDOWN_DAYS} days.`
      : draft.tier !== saved.tier
        ? `Saving this locks visibility for ${TIER_COOLDOWN_DAYS} days, until ${nextLockEnds}.`
        : `You can change this once every ${TIER_COOLDOWN_DAYS} days.`;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={FORM_KEYBOARD_BEHAVIOR}>
      <PageHeader title="Settings" centered />
      <ScrollView contentContainerStyle={styles.content} {...FORM_SCROLL_PROPS}>
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

        <Group title="Account">
          {FIELDS.map((field) => (
            <InfoRow
              key={field.key}
              label={field.label}
              value={field.prefix ? `${field.prefix}${draft[field.key]}` : draft[field.key]}
              onChangeText={(v) => edit(field.key, field.prefix ? v.replace(field.prefix, "") : v)}
            />
          ))}
          <InfoRow label="Code" value={identityCode(positions)} readOnly last />
        </Group>

        <Group title="Bio">
          <TextInput
            value={draft.bio}
            onChangeText={(v) => edit("bio", v)}
            multiline
            placeholder="A line or two about you"
            placeholderTextColor={c.textDim}
            accessibilityLabel="Bio"
            style={styles.bioInput}
          />
        </Group>

        <View>
          <SectionTitle style={styles.groupTitle}>Visibility</SectionTitle>
          <View style={styles.pillTrack} onLayout={onPillTrackLayout}>
            <PillHighlight
              index={TIERS.findIndex((t) => t.id === draft.tier)}
              count={TIERS.length}
              trackWidth={pillTrackWidth}
            />
            {TIERS.map((t) => {
              const active = t.id === draft.tier;
              return (
                <AnimatedPressable
                  key={t.id}
                  onPress={() => edit("tier", t.id)}
                  disabled={tierLocked}
                  scaleTo={0.97}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: tierLocked }}
                  style={styles.pill}
                >
                  <Text
                    style={[
                      styles.pillLabel,
                      active && styles.pillLabelActive,
                      tierLocked && !active && styles.pillLabelLocked,
                    ]}
                  >
                    {t.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          <Text style={styles.note}>{tier.note}</Text>
          <View style={styles.tierRule}>
            <Icon name="lock" size={13} color={tierLocked ? c.text : c.textDim} strokeWidth={2} />
            <Text style={[styles.tierRuleText, tierLocked && styles.tierRuleTextLocked]}>{tierRule}</Text>
          </View>
        </View>

        <Group title="Notifications">
          {NOTIF_ROWS.map((row, i) => (
            <View key={row.key} style={[styles.row, i !== NOTIF_ROWS.length - 1 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Toggle
                value={draft.notifPrefs[row.key]}
                onValueChange={(v) => edit("notifPrefs", { ...draft.notifPrefs, [row.key]: v })}
                label={row.label}
              />
            </View>
          ))}
        </Group>

        <Group title="Public alignment">
          {GRID_LIST.map((grid, i) => (
            <View key={grid.id} style={[styles.row, i !== GRID_LIST.length - 1 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{grid.label}</Text>
              <Toggle
                value={draft.gridPublic[grid.id]}
                onValueChange={(v) => edit("gridPublic", { ...draft.gridPublic, [grid.id]: v })}
                label={`${grid.label} alignment public`}
              />
            </View>
          ))}
        </Group>

        <Group
          title="Session"
          note={
            mode === "remote"
              ? `Signed in as @${state.profile.handle}. Signing out leaves your data on the server.`
              : "Offline build with no server configured — signing out clears your profile from this device."
          }
        >
          {mode === "remote" && (
            <ActionRow
              label={hasPassword === false ? "Set password" : "Change password"}
              onPress={() => setChangingPassword(true)}
              chevron
            />
          )}
          <ActionRow label="Log out" onPress={() => void leave()} last />
        </Group>

        <Group title="Privacy" note="Wipes your votes, positions, takes and messages from Pnyx.">
          <ActionRow label="Forget me" onPress={() => setConfirmWipe(true)} destructive last />
        </Group>

        <Group title="About">
          <ActionRow label="Terms and moderation" onPress={() => setAbout(true)} chevron last />
        </Group>
      </ScrollView>

      {dirty && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(160)}
          style={[styles.saveDock, { paddingBottom: insets.bottom + s[2] }]}
        >
          <View style={styles.saveBar}>
            <Text style={styles.saveCount} numberOfLines={1} accessibilityLiveRegion="polite">
              {changeCount === 1 ? "1 unsaved change" : `${changeCount} unsaved changes`}
            </Text>
            <AnimatedPressable
              onPress={() => setEdits({})}
              disabled={saving}
              scaleTo={0.94}
              style={[styles.discard, saving && styles.saveBarDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Discard changes"
              accessibilityState={{ disabled: saving }}
            >
              <Text style={styles.discardLabel}>Discard</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={save}
              disabled={saving}
              scaleTo={0.94}
              style={styles.saveBtn}
              accessibilityRole="button"
              accessibilityLabel={saving ? "Saving changes" : "Save changes"}
              accessibilityState={{ disabled: saving, busy: saving }}
            >
              {saving ? <LoadingMark size={16} /> : <Icon name="check" size={15} color={c.text} />}
              <Text style={styles.saveLabel}>{saving ? "Saving" : "Save"}</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      )}

      <Sheet open={confirmTier} title="Change visibility?" onClose={() => setConfirmTier(false)}>
        <Text style={styles.sheetLead}>
          You&apos;re switching from {savedTier.label} to {tier.label}. Visibility can only change once every{" "}
          {TIER_COOLDOWN_DAYS} days, so you won&apos;t be able to change it again until {nextLockEnds}.
        </Text>
        <View style={styles.sheetActions}>
          <Btn label="Not now" variant="outline" onPress={() => setConfirmTier(false)} style={{ flex: 1 }} />
          <Btn label="Change and save" onPress={() => void commit()} style={{ flex: 1 }} />
        </View>
      </Sheet>

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
        <View style={styles.legalLinks}>
          <AnimatedPressable
            onPress={() => TERMS_URL && void WebBrowser.openBrowserAsync(TERMS_URL)}
            accessibilityRole="link"
          >
            <Text style={styles.legalLink}>Terms of Service</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => PRIVACY_URL && void WebBrowser.openBrowserAsync(PRIVACY_URL)}
            accessibilityRole="link"
          >
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => EULA_URL && void WebBrowser.openBrowserAsync(EULA_URL)}
            accessibilityRole="link"
          >
            <Text style={styles.legalLink}>EULA</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => DMCA_URL && void WebBrowser.openBrowserAsync(DMCA_URL)}
            accessibilityRole="link"
          >
            <Text style={styles.legalLink}>DMCA Policy</Text>
          </AnimatedPressable>
        </View>
      </Sheet>

      <ChangePasswordSheet
        open={changingPassword}
        onClose={() => setChangingPassword(false)}
        changePassword={changePassword}
        hasPassword={hasPassword !== false}
      />
    </KeyboardAvoidingView>
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
  screen: { flex: 1 },
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
  // One heading, one card, one row: every group on the page uses these.
  groupTitle: {
    color: c.textDim,
    fontSize: f.sm,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "none",
    marginBottom: s[2],
    paddingHorizontal: s[1],
  },
  card: {
    borderRadius: r.lg,
    backgroundColor: c.surface,
    paddingHorizontal: s[4],
    ...squircle,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: s[3],
    gap: s[3],
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.lineSoft },
  rowLabel: { color: c.text, fontSize: f.sm, fontWeight: "500" },
  rowLabelDestructive: { color: c.down, fontWeight: "600" },
  rowValue: { color: c.textDim, fontSize: f.sm, flex: 1, textAlign: "right" },
  rowInput: { color: c.textDim, fontSize: f.sm, flex: 1, paddingVertical: 0 },
  bioInput: {
    color: c.text,
    fontSize: f.sm,
    lineHeight: 20,
    minHeight: 76,
    paddingVertical: s[3],
    textAlignVertical: "top",
  },
  note: { color: c.textDim, fontSize: f.xs, lineHeight: 17, marginTop: s[2], paddingHorizontal: s[1] },
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
  pillLabelLocked: { color: c.textFaint },
  tierRule: { flexDirection: "row", gap: s[1], marginTop: s[2], paddingHorizontal: s[1] },
  tierRuleText: { flex: 1, color: c.textDim, fontSize: f.xs, lineHeight: 17 },
  tierRuleTextLocked: { color: c.text, fontWeight: "600" },
  // Floats above the form as one dark pill, so it reads as a pending decision rather than page chrome.
  saveDock: { paddingHorizontal: s[3], paddingTop: s[2] },
  saveBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[1],
    paddingLeft: s[4] + 2,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: r.full,
    backgroundColor: c.text,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    ...squircle,
  },
  saveCount: { flex: 1, color: c.app, fontSize: f.sm, fontWeight: "600" },
  discard: { height: 44, paddingHorizontal: s[3], justifyContent: "center", borderRadius: r.full },
  discardLabel: { color: hexToRgba(c.app, 0.78), fontSize: f.sm, fontWeight: "600" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: s[4] + 2,
    borderRadius: r.full,
    backgroundColor: c.surface,
    ...squircle,
  },
  saveLabel: { color: c.text, fontSize: f.sm, fontWeight: "700" },
  saveBarDisabled: { opacity: 0.4 },
  sheetLead: { color: c.textDim, fontSize: f.sm, marginBottom: s[4], lineHeight: 20 },
  legalLinks: { gap: s[3] },
  legalLink: { color: c.text, fontSize: f.sm, fontWeight: "600", textDecorationLine: "underline" },
  sheetActions: { flexDirection: "row", gap: s[2] },
});
