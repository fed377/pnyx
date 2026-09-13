import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/Chrome";
import { Crest } from "@/components/Crest";
import { GridPlot } from "@/components/GridPlot";
import { Btn, Card, LockedRow, Note, SectionTitle } from "@/components/Primitives";
import { conviction, UNLOCK_AT, positionHistory } from "@/lib/algorithm";
import { hashSeed, pct } from "@/lib/format";
import { GRID_LIST, nearestPoint, orientationOf } from "@/lib/grids";
import { POWER_LABEL } from "@/lib/feed";
import type { Person, Positions, Vote, VotePower } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";

/** Placeholder rarity figure — real numbers need a population to count against. */
function rarity(label: string): number {
  return 3 + Math.floor(hashSeed(label) * 900);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many of each reaction you've ever cast. */
function voteCounts(votes: Vote[]): Record<VotePower, number> {
  const out: Record<VotePower, number> = { 2: 0, 1: 0, [-1]: 0, [-2]: 0 };
  for (const v of votes) out[v.power]++;
  return out;
}

/** The grid you've pulled furthest from neutral on, and by how much (0..1 of the way to an edge). */
function mostDecisive(positions: Positions): { grid: (typeof GRID_LIST)[number]; pull: number } {
  let best = { grid: GRID_LIST[0], pull: 0 };
  for (const grid of GRID_LIST) {
    const p = positions[grid.id];
    const pull = Math.hypot(p.x, p.y) / Math.SQRT2;
    if (pull > best.pull) best = { grid, pull };
  }
  return best;
}

/** The person in the world you're currently closest to, if anyone's been loaded. */
function closestMatch(people: Person[], alignmentWith: (p: Person) => number): { person: Person; score: number } | null {
  let best: { person: Person; score: number } | null = null;
  for (const person of people) {
    const score = alignmentWith(person);
    if (!best || score > best.score) best = { person, score };
  }
  return best;
}

export default function StatisticsScreen() {
  const { state, positions, unlocked, voteCount, dispatch, accent, people, alignmentWith } = useStore();

  const history = useMemo(() => positionHistory(state.votes, 4), [state.votes]);

  const pastIcons = useMemo(() => {
    if (history.length < 3) return [] as Positions[];
    const step = Math.max(1, Math.floor(history.length / 5));
    return history.filter((_, i) => i % step === 0).slice(-5);
  }, [history]);

  const counts = useMemo(() => voteCounts(state.votes), [state.votes]);
  const total = state.votes.length;
  const decisive = useMemo(() => mostDecisive(positions), [positions]);
  // Date.now() belongs in an effect, not render — this reads "now" once per
  // mount/vote-list-change rather than treating the current instant as a value
  // that's safe to read while rendering.
  const [thisWeek, setThisWeek] = useState(0);
  useEffect(() => {
    setThisWeek(state.votes.filter((v) => v.at >= Date.now() - 7 * DAY_MS).length);
  }, [state.votes]);
  const match = useMemo(() => closestMatch(people, alignmentWith), [people, alignmentWith]);

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

        {total > 0 && (
          <View>
            <SectionTitle>Your patterns</SectionTitle>

            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text style={styles.tileNum}>{pct(conviction(positions) * 100)}</Text>
                <Text style={styles.tileLabel}>Overall conviction</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileNum}>{decisive.grid.label}</Text>
                <Text style={styles.tileLabel}>Strongest opinion</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileNum}>{thisWeek}</Text>
                <Text style={styles.tileLabel}>{thisWeek === 1 ? "Reaction" : "Reactions"} this week</Text>
              </View>
            </View>

            <Card style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>How you react</Text>
              <View style={styles.breakdownBar}>
                {(
                  [
                    [2, c.up],
                    [1, "rgba(63,191,143,0.45)"],
                    [-1, "rgba(229,98,111,0.45)"],
                    [-2, c.down],
                  ] as const
                ).map(([power, color]) => (
                  <View
                    key={power}
                    style={{ width: `${(counts[power] / total) * 100}%`, backgroundColor: color, height: "100%" }}
                  />
                ))}
              </View>
              <View style={styles.breakdownLegend}>
                {(
                  [
                    [2, c.up],
                    [1, "rgba(63,191,143,0.8)"],
                    [-1, "rgba(229,98,111,0.8)"],
                    [-2, c.down],
                  ] as const
                ).map(([power, color]) => (
                  <View key={power} style={styles.breakdownItem}>
                    <View style={[styles.breakdownDot, { backgroundColor: color }]} />
                    <Text style={styles.breakdownText}>
                      {POWER_LABEL[power]} <Text style={styles.strong}>{counts[power]}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            {match && match.score > 0 && (
              <Card style={styles.matchCard}>
                <Avatar name={match.person.name} positions={match.person.positions} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchLabel}>Your closest match right now</Text>
                  <Text style={styles.matchName}>{match.person.name}</Text>
                </View>
                <Text style={[styles.matchScore, { color: accent }]}>{pct(match.score)}</Text>
              </Card>
            )}
          </View>
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
  tiles: { flexDirection: "row", gap: s[2], marginBottom: s[3] },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: s[3],
    borderRadius: r.md,
    backgroundColor: c.surface,
    ...squircle,
  },
  tileNum: { color: c.text, fontSize: f.lg, fontWeight: "700" },
  tileLabel: { color: c.textFaint, fontSize: 10, textAlign: "center" },
  breakdown: { gap: s[3], marginBottom: s[3] },
  breakdownTitle: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1.1, textTransform: "uppercase" },
  breakdownBar: { flexDirection: "row", height: 8, borderRadius: r.full, overflow: "hidden", backgroundColor: c.surface3 },
  breakdownLegend: { flexDirection: "row", flexWrap: "wrap", gap: s[1], columnGap: s[4] },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  breakdownDot: { width: 7, height: 7, borderRadius: r.full },
  breakdownText: { color: c.textDim, fontSize: f.xs },
  matchCard: { flexDirection: "row", alignItems: "center", gap: s[3] },
  matchLabel: { color: c.textFaint, fontSize: f.xs },
  matchName: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  matchScore: { fontSize: f.lg, fontWeight: "700" },
  statgrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[4],
    padding: s[4],
    borderRadius: r.md,
    backgroundColor: c.surface,
    ...squircle,
  },
  statBody: { flex: 1 },
  statGridName: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1.1 },
  statNameRow: { flexDirection: "row", alignItems: "center", gap: s[2], marginTop: 2 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  statName: { color: c.text, fontSize: f.lg, fontWeight: "600" },
  statOrient: { fontSize: f.xs },
  statMeta: { color: c.textFaint, fontSize: f.xs, marginTop: s[2] },
});
