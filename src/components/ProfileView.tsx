import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { identityCode } from "@/lib/algorithm";
import { GRID_LIST, nearestPoint, orientationOf } from "@/lib/grids";
import type { Content, GridId, Positions } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, r, s } from "@/theme/tokens";
import { AlignmentDial } from "./Alignment";
import { Crest } from "./Crest";
import { Icon } from "./Icon";
import { Media } from "./Media";
import { Empty, SectionTitle, SegTabs } from "./Primitives";

const HOTCHIVE = ["Cities", "Kitchen", "Arguments", "2025"];

function GridCard({
  gridId,
  positions,
  locked,
  hidden,
}: {
  gridId: GridId;
  positions: Positions;
  locked: boolean;
  hidden: boolean;
}) {
  const { accent } = useStore();
  const grid = GRID_LIST.find((g) => g.id === gridId)!;
  const p = positions[gridId];
  const near = nearestPoint(gridId, p);

  if (locked || hidden) {
    return (
      <View style={[styles.gcard, styles.gcardLocked]}>
        <Icon name="lock" size={16} color={c.textFaint} />
        <View style={{ flex: 1 }}>
          <Text style={styles.gcardGrid}>{grid.label}</Text>
          <Text style={styles.gcardName}>{locked ? "Not yet revealed" : "Kept private"}</Text>
          <Text style={styles.gcardMeaning}>
            {locked ? "Unlocks at 50 reactions." : "This grid isn't shared publicly."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.gcard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.gcardGrid}>
          {grid.label.toUpperCase()} <Text style={styles.gcardDetermines}>· {grid.determines}</Text>
        </Text>
        <View style={styles.gcardNameRow}>
          {near.hex && <View style={[styles.swatch, { backgroundColor: near.hex }]} />}
          <Text style={styles.gcardName}>
            {near.animal ? `${near.name} · ${near.animal[0].toUpperCase()}${near.animal.slice(1)}` : near.name}
          </Text>
        </View>
        <Text style={[styles.gcardOrient, { color: accent }]}>{orientationOf(gridId, p)}</Text>
        <Text style={styles.gcardMeaning}>{near.meaning}</Text>
        <Text style={styles.gcardCoords}>
          x {p.x.toFixed(2)} · y {p.y.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

function Archive({ items, empty }: { items: Content[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <View style={styles.archive}>
      {items.map((item) => (
        <View key={item.id} style={styles.archiveItem}>
          <Media id={item.id} scores={item.scores} mediaUrl={item.mediaUrl} ratio={1} />
          <Text style={styles.archiveText} numberOfLines={3}>
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ProfileView({
  name,
  handle,
  pronouns,
  bio,
  city,
  positions,
  alignment,
  animateAlignment = false,
  locked = false,
  hiddenGrids = [],
  loved,
  hated,
  posts,
  actions,
  footer,
}: {
  name: string;
  handle: string;
  pronouns: string;
  bio: string;
  city: string;
  positions: Positions;
  alignment: number;
  animateAlignment?: boolean;
  /** Type not yet earned — fewer than 50 reactions. */
  locked?: boolean;
  /** Grids this person keeps private. */
  hiddenGrids?: GridId[];
  loved: Content[];
  hated: Content[];
  posts: Content[];
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const { accent } = useStore();
  const [tab, setTab] = useState<"loved" | "hated" | "posts">("loved");

  return (
    <View style={{ gap: s[5] }}>
      <View style={styles.phead}>
        <Crest positions={positions} size={84} locked={locked} />
        <View style={styles.pheadId}>
          <Text style={styles.pheadName} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.pheadHandle}>
            @{handle} · {pronouns}
          </Text>
          <Text style={styles.pheadCity}>{city}</Text>
        </View>
        <AlignmentDial value={alignment} animate={animateAlignment} size={88} />
      </View>

      <Text style={styles.bio}>{bio}</Text>

      <View style={styles.code}>
        <Text style={styles.codeLabel}>Identity code</Text>
        <Text style={styles.codeValue}>{locked ? "—·—·—·—·—" : identityCode(positions)}</Text>
      </View>

      {actions && <View style={styles.actions}>{actions}</View>}

      <View>
        <SectionTitle>Hotchive</SectionTitle>
        <View style={styles.hotchive}>
          {HOTCHIVE.map((label, i) => (
            <View key={label} style={styles.hotchiveItem}>
              <View style={[styles.hotchiveRing, { borderColor: i === 0 ? accent : c.line }]}>
                <Icon name="feed" size={18} color={c.textFaint} />
              </View>
              <Text style={styles.hotchiveLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>The five grids</SectionTitle>
        <View style={{ gap: s[2] }}>
          {GRID_LIST.map((g) => (
            <GridCard
              key={g.id}
              gridId={g.id}
              positions={positions}
              locked={locked}
              hidden={hiddenGrids.includes(g.id)}
            />
          ))}
        </View>
      </View>

      <View>
        <SegTabs
          value={tab}
          onChange={setTab}
          tabs={[
            ["loved", `Loved ${loved.length}`],
            ["hated", `Hated ${hated.length}`],
            ["posts", `Posts ${posts.length}`],
          ]}
        />
        <View style={{ paddingTop: s[4] }}>
          {tab === "loved" && <Archive items={loved} empty="Nothing loved yet. Hold the like button for 1.5 seconds." />}
          {tab === "hated" && <Archive items={hated} empty="Nothing hated yet. That's allowed." />}
          {tab === "posts" && <Archive items={posts} empty="No posts yet." />}
        </View>
      </View>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  phead: { flexDirection: "row", alignItems: "center", gap: s[3] },
  pheadId: { flex: 1 },
  pheadName: { color: c.text, fontSize: f.xl, fontWeight: "600", letterSpacing: -0.4 },
  pheadHandle: { color: c.textDim, fontSize: f.sm },
  pheadCity: { color: c.textFaint, fontSize: f.xs },
  bio: { color: c.textDim, fontSize: f.md, lineHeight: 22, marginTop: -s[3] },
  code: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: s[3],
    paddingHorizontal: s[4],
    paddingVertical: s[3],
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.md,
    backgroundColor: c.surface,
  },
  codeLabel: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1.1, textTransform: "uppercase" },
  codeValue: { color: c.text, fontSize: f.lg, fontWeight: "600", letterSpacing: 1.4 },
  actions: { flexDirection: "row", gap: s[2], flexWrap: "wrap" },
  hotchive: { flexDirection: "row", gap: s[4] },
  hotchiveItem: { alignItems: "center", gap: 6 },
  hotchiveRing: {
    width: 56,
    height: 56,
    borderRadius: r.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  hotchiveLabel: { color: c.textDim, fontSize: f.xs },
  gcard: {
    flexDirection: "row",
    gap: s[3],
    padding: s[4],
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: r.md,
    backgroundColor: c.surface,
  },
  gcardLocked: { borderStyle: "dashed", backgroundColor: "transparent" },
  gcardGrid: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1.1 },
  gcardDetermines: { letterSpacing: 0.2, textTransform: "none" },
  gcardNameRow: { flexDirection: "row", alignItems: "center", gap: s[2], marginTop: 2 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  gcardName: { color: c.text, fontSize: f.lg, fontWeight: "600" },
  gcardOrient: { fontSize: f.xs },
  gcardMeaning: { color: c.textDim, fontSize: f.sm, marginTop: s[2], lineHeight: 19 },
  gcardCoords: { color: c.textFaint, fontSize: f.xs, marginTop: s[2] },
  archive: { flexDirection: "row", flexWrap: "wrap", gap: s[3] },
  archiveItem: { width: "47%", flexGrow: 1, gap: s[2] },
  archiveText: { color: c.textDim, fontSize: f.xs, lineHeight: 16 },
});
