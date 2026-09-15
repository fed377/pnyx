import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AlignmentPill } from "@/components/Alignment";
import { AnimatedPressable, enterDelay } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { BlurBackdrop } from "@/components/BlurBackdrop";
import { TopBar } from "@/components/Chrome";
import { Chip, Empty, LockedRow, Note, SegTabs } from "@/components/Primitives";
import { GRID_LIST, nearestPoint } from "@/lib/grids";
import type { GridId, Person } from "@/lib/types";
import { usePeopleSearch } from "@/state/peopleSearch";
import { useStore } from "@/state/store";
import { c, display, f, s, TAB_BAR_CLEARANCE } from "@/theme/tokens";

const WORLD_LIMIT = 10;
const MOST_ALIGNED_LIMIT = 6;
const FRIENDS_FIRST_THRESHOLD = 50;

const capitalize = (w: string) => w[0]!.toUpperCase() + w.slice(1);

function MostAligned({ people }: { people: { p: Person; a: number }[] }) {
  const router = useRouter();
  if (people.length === 0) return null;

  return (
    <View style={{ gap: s[3] }}>
      <Text style={styles.subhead}>Most aligned in the world</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mostRow}>
        {people.map(({ p, a }) => (
          <AnimatedPressable
            key={p.id}
            scaleTo={0.93}
            style={styles.mostItem}
            accessibilityRole="link"
            accessibilityLabel={`Open ${p.name}'s profile, ${Math.round(a)} percent aligned`}
            onPress={() => router.push({ pathname: "/u/[id]", params: { id: p.id } })}
          >
            <Avatar name={p.name} positions={p.positions} size={64} badge={false} photoUrl={p.avatarUrl} />
            <Text style={styles.mostPct}>{Math.round(a)}%</Text>
            <Text style={styles.mostName} numberOfLines={1}>
              {p.name.split(" ")[0]}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

function PersonRow({
  person,
  alignment,
  gridFocus,
  index,
}: {
  person: Person;
  alignment: number;
  gridFocus: GridId;
  index: number;
}) {
  const router = useRouter();
  const type = nearestPoint(gridFocus, person.positions[gridFocus]);

  return (
    <Animated.View entering={FadeInDown.duration(240).delay(enterDelay(index))}>
      <AnimatedPressable
        scaleTo={0.98}
        style={styles.row}
        accessibilityRole="link"
        accessibilityLabel={`Open ${person.name}'s profile, ${Math.round(alignment)} percent aligned`}
        onPress={() => router.push({ pathname: "/u/[id]", params: { id: person.id } })}
      >
        <Avatar name={person.name} positions={person.positions} size={44} photoUrl={person.avatarUrl} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {person.name} <Text style={styles.rowPronouns}>{person.pronouns}</Text>
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {type.animal ? `${capitalize(type.animal)} · ` : ""}
            {type.name}.
          </Text>
        </View>
        <AlignmentPill value={alignment} />
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function PeopleScreen() {
  const { alignmentWith, state, dispatch, isFollowing, people: everyone, refresh, loading, mode, accent } =
    useStore();
  const { query } = usePeopleSearch();
  const [tab, setTab] = useState<"world" | "following" | "followers">("world");
  const [gridFocus, setGridFocus] = useState<GridId | "all">("all");
  const friendsFirst = state.alignmentFilter >= FRIENDS_FIRST_THRESHOLD;

  const ranked = useMemo(
    () =>
      everyone.map((p) => ({ p, a: alignmentWith(p) }))
        .filter(({ a }) => a >= state.alignmentFilter)
        .sort((x, y) => y.a - x.a),
    [alignmentWith, state.alignmentFilter, everyone],
  );

  const searching = query.trim().length > 0;
  const q = query.trim().toLowerCase();

  const list = searching
    ? ranked.filter(({ p }) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q))
    : tab === "world"
      ? ranked.slice(0, WORLD_LIMIT)
      : tab === "following"
        ? ranked.filter(({ p }) => isFollowing(p.id))
        : ranked.filter(({ p }) => p.follower);

  const hiddenByPremium = !searching && tab === "world" ? Math.max(0, ranked.length - WORLD_LIMIT) : 0;

  return (
    <BlurBackdrop style={styles.screen}>
      <TopBar showWordmark={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          mode === "remote" ? (
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={accent} colors={[accent]} />
          ) : undefined
        }
      >
        <Text style={styles.title}>People</Text>

        <MostAligned people={ranked.slice(0, MOST_ALIGNED_LIMIT)} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip
            label="Any alignment"
            selected={!friendsFirst}
            onPress={() => dispatch({ type: "filter", value: 0 })}
          />
          <Chip
            label="Friends first"
            selected={friendsFirst}
            onPress={() => dispatch({ type: "filter", value: FRIENDS_FIRST_THRESHOLD })}
          />
          <Chip label="All" selected={gridFocus === "all"} onPress={() => setGridFocus("all")} />
          {GRID_LIST.map((g) => (
            <Chip key={g.id} label={g.label} selected={gridFocus === g.id} onPress={() => setGridFocus(g.id)} />
          ))}
        </ScrollView>

        {!searching && (
          <SegTabs
            value={tab}
            onChange={setTab}
            tabs={[
              ["world", "Most aligned"],
              ["following", "Following"],
              ["followers", "Followers"],
            ]}
          />
        )}

        {!searching && tab === "world" && (
          <Note icon="globe">The ten people in the world closest to your five grids, right now.</Note>
        )}

        <View>
          <Text style={styles.subhead}>Everyone, by alignment</Text>
          {list.length === 0 ? (
            <Empty>
              {searching ? `No one matches "${query.trim()}".` : "Nobody here clears your alignment filter yet."}
            </Empty>
          ) : (
            <View>
              {list.map(({ p, a }, i) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  alignment={a}
                  gridFocus={gridFocus === "all" ? "values" : gridFocus}
                  index={i}
                />
              ))}
            </View>
          )}
        </View>

        {hiddenByPremium > 0 && (
          <LockedRow>
            <Text style={styles.lockedText}>
              <Text style={styles.lockedStrong}>{hiddenByPremium} more matches</Text> beyond your top ten. Premium opens
              the full global list.
            </Text>
          </LockedRow>
        )}
      </ScrollView>
    </BlurBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], paddingBottom: TAB_BAR_CLEARANCE, gap: s[5] },
  title: { color: c.text, fontSize: 34, fontFamily: display.bold, letterSpacing: -0.6 },
  subhead: { color: c.text, fontSize: f.md, fontWeight: "600" },
  mostRow: { gap: s[4], paddingRight: s[4] },
  mostItem: { alignItems: "center", gap: 4, width: 68 },
  mostPct: { color: c.text, fontSize: f.sm, fontWeight: "700", marginTop: 4 },
  mostName: { color: c.textDim, fontSize: f.xs },
  chipRow: { gap: s[2], paddingRight: s[4] },
  row: { flexDirection: "row", alignItems: "center", gap: s[3], paddingVertical: s[3], paddingHorizontal: s[2] },
  rowBody: { flex: 1 },
  rowName: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  rowPronouns: { color: c.textFaint, fontWeight: "400" },
  rowMeta: { color: c.textFaint, fontSize: f.xs, marginTop: 2 },
  lockedText: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  lockedStrong: { color: c.text, fontWeight: "600" },
});
