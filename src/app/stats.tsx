import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PageHeader } from "@/components/Chrome";
import { Crest } from "@/components/Crest";
import { GridPlot } from "@/components/GridPlot";
import { Btn, LockedRow, Note, SectionTitle } from "@/components/Primitives";
import { positionHistory, UNLOCK_AT } from "@/lib/algorithm";
import { hashSeed } from "@/lib/format";
import { GRID_LIST, nearestPoint, orientationOf } from "@/lib/grids";
import type { Positions } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, r, s } from "@/theme/tokens";

/** Placeholder rarity figure — real numbers need a population to count against. */
function rarity(label: string): number {
  return 3 + Math.floor(hashSeed(label) * 900);
}

export default function StatisticsScreen() {
  const { state, positions, unlocked, voteCount, dispatch, accent } = useStore();

  const history = useMemo(() => positionHistory(state.votes, 4), [state.votes]);

  const pastIcons = useMemo(() => {
    if (history.length < 3) return [] as Positions[];
    const step = Math.max(1, Math.floor(history.length / 5));
    return history.filter((_, i) => i % step === 0).slice(-5);
  }, [history]);

  return (
    <View style={styles.screen}>
      <PageHeader title="Statistics" />
      <ScrollView contentContainerStyle={styles.content}>
        <Note icon="stats">{`${voteCount} reactions recorded · the last 250 count toward your position.`}</Note>

        {!unlocked && (
          <LockedRow>
            <Text style={styles.lockedText}>
              Grids keep moving before the unlock, but the named type appears at{" "}
              <Text style={styles.strong}>{UNLOCK_AT}</Text> reactions.
            </Text>
          </LockedRow>
        )}

        {pastIcons.length > 1 && (
          <View>
            <SectionTitle>How your icon changed</SectionTitle>
            <View style={styles.iconRow}>
              {pastIcons.map((p, i) => (
                <View key={i} style={styles.iconItem}>
                  <Crest positions={p} size={46} dot={false} locked={!unlocked} />
                  <Text style={styles.iconLabel}>
                    {i === pastIcons.length - 1 ? "now" : `−${(pastIcons.length - 1 - i) * 4}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {GRID_LIST.map((grid) => {
          const p = positions[grid.id];
          const near = nearestPoint(grid.id, p);
          const trail = history.map((h) => h[grid.id]);
          return (
            <View key={grid.id} style={styles.statgrid}>
              <GridPlot gridId={grid.id} position={p} trail={trail} size={126} />
              <View style={styles.statBody}>
                <Text style={styles.statGridName}>{grid.label.toUpperCase()}</Text>
                <View style={styles.statNameRow}>
                  {near.hex && <View style={[styles.swatch, { backgroundColor: near.hex }]} />}
                  <Text style={styles.statName}>{unlocked ? near.name : "Unrevealed"}</Text>
                </View>
                <Text style={[styles.statOrient, { color: accent }]}>{orientationOf(grid.id, p)}</Text>
                <Text style={styles.statMeta}>
                  Shared by {rarity(`${grid.label}-${near.name}`)} people in your region
                </Text>
              </View>
            </View>
          );
        })}

        {state.premium ? (
          <Note icon="check">Premium active — full history retained.</Note>
        ) : (
          <LockedRow
            action={
              <Btn label="Try premium" variant="accent" onPress={() => dispatch({ type: "premium", value: true })} />
            }
          >
            <Text style={styles.lockedText}>
              <Text style={styles.strong}>Deeper history</Text> — month-by-month drift on every grid, kept beyond the
              250-vote window.
            </Text>
          </LockedRow>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: s[7], gap: s[4] },
  lockedText: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  strong: { color: c.text, fontWeight: "600" },
  iconRow: { flexDirection: "row", gap: s[3] },
  iconItem: { alignItems: "center", gap: 5 },
  iconLabel: { color: c.textFaint, fontSize: 10 },
  statgrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[4],
    padding: s[4],
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.md,
    backgroundColor: c.surface,
  },
  statBody: { flex: 1 },
  statGridName: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1.1 },
  statNameRow: { flexDirection: "row", alignItems: "center", gap: s[2], marginTop: 2 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  statName: { color: c.text, fontSize: f.lg, fontWeight: "600" },
  statOrient: { fontSize: f.xs },
  statMeta: { color: c.textFaint, fontSize: f.xs, marginTop: s[2] },
});
