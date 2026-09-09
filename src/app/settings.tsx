import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { PageHeader } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { Btn, Card, Field, SectionTitle } from "@/components/Primitives";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { GRID_LIST } from "@/lib/grids";
import type { PrivacyTier } from "@/lib/types";
import { useSession } from "@/state/session";
import { useStore } from "@/state/store";
import type { Profile } from "@/state/store";
import { c, f, r, s } from "@/theme/tokens";

const TIERS: { id: PrivacyTier; label: string; note: string }[] = [
  { id: "speaker", label: "Speaker", note: "Most public. Only Speakers can post." },
  { id: "active", label: "Active", note: "Profile and three grids visible to everyone." },
  { id: "private", label: "Private", note: "Grids hidden. You still get alignment scores." },
];

type TextKey = "name" | "handle" | "pronouns" | "city";

const FIELDS: { key: TextKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "handle", label: "Handle" },
  { key: "pronouns", label: "Pronouns" },
  { key: "city", label: "City" },
];

export default function SettingsScreen() {
  const { state, dispatch, accent, accentSoft, saveProfile, forgetMe, mode } = useStore();
  const { signOut } = useSession();
  const toast = useToast();
  const [confirmWipe, setConfirmWipe] = useState(false);

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

  return (
    <View style={styles.screen}>
      <PageHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <SectionTitle>Account</SectionTitle>
          {FIELDS.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              value={state.profile[field.key]}
              onChangeText={(v) => setField(field.key, v)}
            />
          ))}
          <Field
            label="Bio"
            value={state.profile.bio}
            onChangeText={(v) => void saveProfile({ bio: v })}
            multiline
          />
        </Card>

        <Card>
          <SectionTitle>Visibility</SectionTitle>
          <Text style={styles.note}>One change per 30 days.</Text>
          <View style={{ gap: s[2] }}>
            {TIERS.map((tier) => {
              const active = state.profile.tier === tier.id;
              return (
                <Pressable
                  key={tier.id}
                  onPress={() => void saveProfile({ tier: tier.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.tier,
                    active && { borderColor: accent, backgroundColor: accentSoft },
                  ]}
                >
                  <View style={[styles.mark, active && { borderColor: accent }]}>
                    {active && <Icon name="check" size={14} color={accent} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierLabel}>{tier.label}</Text>
                    <Text style={styles.tierNote}>{tier.note}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <SectionTitle>Public alignment</SectionTitle>
          <Text style={styles.note}>Choose which grids other people can compare themselves against.</Text>
          {GRID_LIST.map((grid, i) => (
            <View key={grid.id} style={[styles.toggle, i === GRID_LIST.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.toggleLabel}>{grid.label}</Text>
              <Switch
                value={state.gridPublic[grid.id]}
                onValueChange={(v) => dispatch({ type: "gridPublic", grid: grid.id, value: v })}
                accessibilityLabel={`${grid.label} alignment public`}
                trackColor={{ false: c.surface3, true: accentSoft }}
                thumbColor={state.gridPublic[grid.id] ? accent : c.textFaint}
              />
            </View>
          ))}
        </Card>

        {mode === "remote" && (
          <Card>
            <SectionTitle>Session</SectionTitle>
            <Text style={styles.note}>
              Signed in as @{state.profile.handle}. Signing out leaves your data on the server.
            </Text>
            <Btn label="Log out" onPress={() => void leave()} />
          </Card>
        )}

        <Card style={{ borderColor: "rgba(229,98,111,0.28)" }}>
          <SectionTitle>Forget me</SectionTitle>
          <Text style={styles.note}>
            Erases your profile, every vote, and all five grid positions. This cannot be undone, and nothing is kept
            behind.
          </Text>
          <Btn label="Forget me" variant="danger" onPress={() => setConfirmWipe(true)} />
        </Card>
      </ScrollView>

      <Sheet open={confirmWipe} title="Erase everything?" onClose={() => setConfirmWipe(false)}>
        <Text style={styles.sheetLead}>
          Your {state.votes.length} recorded reactions and all five grid positions will be deleted immediately.
        </Text>
        <View style={styles.sheetActions}>
          <Btn label="Keep my data" onPress={() => setConfirmWipe(false)} style={{ flex: 1 }} />
          <Btn label="Erase everything" variant="danger" onPress={() => void wipe()} style={{ flex: 1 }} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7], gap: s[4] },
  note: { color: c.textDim, fontSize: f.sm, marginBottom: s[3], lineHeight: 19 },
  tier: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: s[3],
    padding: s[3],
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.md,
    backgroundColor: c.surface2,
  },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  tierLabel: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  tierNote: { color: c.textDim, fontSize: f.xs, marginTop: 2 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: s[2],
    borderBottomWidth: 1,
    borderBottomColor: c.lineSoft,
  },
  toggleLabel: { color: c.text, fontSize: f.sm },
  sheetLead: { color: c.textDim, fontSize: f.sm, marginBottom: s[4], lineHeight: 20 },
  sheetActions: { flexDirection: "row", gap: s[2] },
});
