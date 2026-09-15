import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { identityCode } from "@/lib/algorithm";
import { GRID_LIST, nearestPoint } from "@/lib/grids";
import type { Content, GridId, Positions } from "@/lib/types";
import { c, display, f, r, s, squircle } from "@/theme/tokens";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Media } from "./Media";
import { Empty, SectionTitle, SegTabs } from "./Primitives";

const HOTCHIVE = ["Cities", "Kitchen", "Arguments", "2025"];

/** The small quadrant-and-position mark shown on every grid tile — a plain
 * decoration of the app's own core concept (a point on a two-axis grid),
 * not tied to any specific grid's data. */
function GridMark() {
  return (
    <View style={styles.mark}>
      <View style={styles.markVBar} />
      <View style={styles.markHBar} />
      <View style={styles.markDot} />
    </View>
  );
}

function GridTile({
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
  const grid = GRID_LIST.find((g) => g.id === gridId)!;

  if (locked || hidden) {
    return (
      <View style={[styles.gtile, styles.gtileLocked]}>
        <Icon name="lock" size={14} color={c.textFaint} />
        <Text style={styles.gtileName} numberOfLines={2}>
          {locked ? "Not yet revealed" : "Kept private"}
        </Text>
        <Text style={styles.gtileLabel}>{grid.label}</Text>
      </View>
    );
  }

  const near = nearestPoint(gridId, positions[gridId]);
  return (
    <View style={styles.gtile}>
      <GridMark />
      <Text style={styles.gtileName} numberOfLines={1}>
        {near.name}
      </Text>
      <Text style={styles.gtileLabel}>{grid.label}</Text>
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
  positions,
  alignment,
  alignmentCaption,
  locked = false,
  hiddenGrids = [],
  stats,
  mostAligned,
  loved,
  hated,
  posts,
  actions,
  footer,
  photoUrl,
}: {
  name: string;
  handle: string;
  pronouns: string;
  bio: string;
  positions: Positions;
  alignment: number;
  /** A real uploaded photo, when they have one. */
  photoUrl?: string;
  /** "you" on your own profile, "aligned" on someone else's. */
  alignmentCaption: string;
  /** Type not yet earned — fewer than 50 reactions. */
  locked?: boolean;
  /** Grids this person keeps private. */
  hiddenGrids?: GridId[];
  /** Followers/following totals for an arbitrary other person aren't modeled
   * (only your own follow relationship to them is) — those two stay optional
   * rather than faked, while `posts` is always real (their own content). */
  stats?: { posts: number; followers?: number; following?: number };
  mostAligned?: { label: string; name: string; pct: number };
  loved: Content[];
  hated: Content[];
  posts: Content[];
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const [tab, setTab] = useState<"posts" | "loved" | "hated">("posts");
  const primary = locked ? null : nearestPoint("values", positions.values);

  return (
    <View style={{ gap: s[5] }}>
      <View style={styles.phead}>
        <Avatar name={name} positions={positions} size={84} locked={locked} photoUrl={photoUrl} />
        <View style={styles.pheadId}>
          <Text style={styles.pheadName} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.pheadHandle}>
            {pronouns} · @{handle}
          </Text>
          <Text style={styles.pheadCode}>{locked ? "—·—·—·—·—" : identityCode(positions)}</Text>
        </View>
        <View style={styles.pheadAlign}>
          <Text style={styles.pheadPct}>{Math.round(alignment)}%</Text>
          <Text style={styles.pheadAlignCaption}>{alignmentCaption}</Text>
        </View>
      </View>

      {primary && (
        <View style={styles.summary}>
          <GridMark />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryName}>
              {primary.animal ? `${primary.animal[0]!.toUpperCase()}${primary.animal.slice(1)}` : primary.name}
              {" · "}
              {primary.name}.
            </Text>
            <Text style={styles.summaryMeaning}>{primary.meaning}</Text>
          </View>
        </View>
      )}

      <Text style={styles.bio}>{bio}</Text>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{stats.posts}</Text>
            <Text style={styles.statLabel}> posts</Text>
          </View>
          {stats.followers !== undefined && (
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{stats.followers}</Text>
              <Text style={styles.statLabel}> followers</Text>
            </View>
          )}
          {stats.following !== undefined && (
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{stats.following}</Text>
              <Text style={styles.statLabel}> following</Text>
            </View>
          )}
        </View>
      )}

      {mostAligned && (
        <Text style={styles.mostAligned}>
          Most aligned with {mostAligned.label}: <Text style={styles.mostAlignedName}>{mostAligned.name}</Text>,{" "}
          {Math.round(mostAligned.pct)}%
        </Text>
      )}

      {actions && <View style={styles.actions}>{actions}</View>}

      <View>
        <SectionTitle>Five grids</SectionTitle>
        <View style={styles.gtiles}>
          {GRID_LIST.map((g) => (
            <GridTile
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
        <SectionTitle>Hotchive</SectionTitle>
        <View style={styles.hotchive}>
          {HOTCHIVE.map((label) => (
            <View key={label} style={styles.hotchiveItem}>
              <View style={styles.hotchiveRing}>
                <Icon name="feed" size={18} color={c.text} />
              </View>
              <Text style={styles.hotchiveLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <SegTabs
          value={tab}
          onChange={setTab}
          tabs={[
            ["posts", `Posts ${posts.length}`],
            ["loved", `Loved ${loved.length}`],
            ["hated", `Hated ${hated.length}`],
          ]}
        />
        <View style={{ paddingTop: s[4] }}>
          {tab === "posts" && <Archive items={posts} empty="No posts yet." />}
          {tab === "loved" && <Archive items={loved} empty="Nothing loved yet. Hold the like button for 1.5 seconds." />}
          {tab === "hated" && <Archive items={hated} empty="Nothing hated yet. That's allowed." />}
        </View>
      </View>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  phead: { flexDirection: "row", alignItems: "flex-start", gap: s[3] },
  pheadId: { flex: 1 },
  pheadName: { color: c.text, fontSize: f.xl, fontFamily: display.semibold, letterSpacing: -0.4 },
  pheadHandle: { color: c.textDim, fontSize: f.sm, marginTop: 1 },
  pheadCode: { color: c.textFaint, fontSize: f.xs, letterSpacing: 1, marginTop: 2 },
  pheadAlign: { alignItems: "flex-end" },
  pheadPct: { color: c.text, fontSize: 30, fontFamily: display.bold, letterSpacing: -0.6 },
  pheadAlignCaption: { color: c.textFaint, fontSize: f.xs, marginTop: -2 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[3],
    padding: s[4],
    borderRadius: r.lg,
    backgroundColor: c.surface,
    ...squircle,
  },
  summaryName: { color: c.text, fontSize: f.md, fontFamily: display.semibold },
  summaryMeaning: { color: c.textDim, fontSize: f.sm, marginTop: 2 },
  bio: { color: c.text, fontSize: f.md, lineHeight: 22 },
  statsRow: { flexDirection: "row", gap: s[2] },
  statPill: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: s[3],
    paddingVertical: s[2],
    borderRadius: r.full,
    backgroundColor: c.surface2,
    ...squircle,
  },
  statNum: { color: c.text, fontSize: f.sm, fontWeight: "700" },
  statLabel: { color: c.textDim, fontSize: f.sm },
  mostAligned: { color: c.textDim, fontSize: f.xs },
  mostAlignedName: { color: c.text, fontWeight: "600" },
  actions: { flexDirection: "row", gap: s[2], flexWrap: "wrap" },
  gtiles: { flexDirection: "row", gap: s[2] },
  gtile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: r.md,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: s[1],
    ...squircle,
  },
  gtileLocked: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: c.line },
  gtileName: { color: c.text, fontSize: f.xs, fontWeight: "700" },
  gtileLabel: { color: c.textFaint, fontSize: 10 },
  mark: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  markVBar: { position: "absolute", width: 1, height: 20, backgroundColor: c.line },
  markHBar: { position: "absolute", width: 20, height: 1, backgroundColor: c.line },
  markDot: { position: "absolute", width: 5, height: 5, borderRadius: 3, backgroundColor: c.text, top: 4, left: 12 },
  hotchive: { flexDirection: "row", gap: s[4] },
  hotchiveItem: { alignItems: "center", gap: 6 },
  hotchiveRing: {
    width: 56,
    height: 56,
    borderRadius: r.full,
    borderWidth: 1.5,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  hotchiveLabel: { color: c.textDim, fontSize: f.xs },
  archive: { flexDirection: "row", flexWrap: "wrap", gap: s[3] },
  archiveItem: { width: "47%", flexGrow: 1, gap: s[2] },
  archiveText: { color: c.textDim, fontSize: f.xs, lineHeight: 16 },
});
