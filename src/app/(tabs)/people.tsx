import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AlignmentPill } from "@/components/Alignment";
import { AlignmentFilter } from "@/components/AlignmentFilter";
import { AnimatedPressable, enterDelay } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/Avatar";
import { BlurBackdrop } from "@/components/BlurBackdrop";
import { TopBar } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { Empty, LockedRow, Note, SegTabs } from "@/components/Primitives";
import { nearestPoint } from "@/lib/grids";
import type { Person } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, r, s, TAB_BAR_CLEARANCE } from "@/theme/tokens";

const WORLD_LIMIT = 10;

function PersonRow({
  person,
  alignment,
  rank,
  index,
}: {
  person: Person;
  alignment: number;
  rank?: number;
  index: number;
}) {
  const router = useRouter();
  const type = nearestPoint("values", person.positions.values);

  return (
    <Animated.View entering={FadeInDown.duration(240).delay(enterDelay(index))}>
      <AnimatedPressable
        scaleTo={0.98}
        style={styles.row}
        accessibilityRole="link"
        accessibilityLabel={`Open ${person.name}'s profile, ${Math.round(alignment)} percent aligned`}
        onPress={() => router.push({ pathname: "/u/[id]", params: { id: person.id } })}
      >
        {rank !== undefined && <Text style={styles.rank}>{rank}</Text>}
        <Avatar name={person.name} positions={person.positions} size={44} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName}>{person.name}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            @{person.handle} · {type.name} · {person.city}
          </Text>
        </View>
        <AlignmentPill value={alignment} />
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function PeopleScreen() {
  const { alignmentWith, state, isFollowing, people: everyone, refresh, loading, mode, accent } = useStore();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"world" | "following" | "followers">("world");

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
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          mode === "remote" ? (
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={accent} colors={[accent]} />
          ) : undefined
        }
      >
        <View style={styles.search}>
          <Icon name="search" size={18} color={c.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or handle"
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Search people"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {searching && (
            <AnimatedPressable
              onPress={() => setQuery("")}
              hitSlop={8}
              scaleTo={0.85}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="close" size={16} color={c.textDim} />
            </AnimatedPressable>
          )}
        </View>

        <AlignmentFilter />

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
                rank={!searching && tab === "world" ? i + 1 : undefined}
                index={i}
              />
            ))}
          </View>
        )}

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
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[2],
    height: 44,
    paddingHorizontal: s[3],
    borderRadius: r.full,
    backgroundColor: c.surface,
  },
  searchInput: { flex: 1, color: c.text, fontSize: f.sm, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: s[3], paddingVertical: s[3], paddingHorizontal: s[2] },
  rank: { width: 18, color: c.textFaint, fontSize: f.sm, textAlign: "right" },
  rowBody: { flex: 1 },
  rowName: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  rowMeta: { color: c.textFaint, fontSize: f.xs },
  lockedText: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  lockedStrong: { color: c.text, fontWeight: "600" },
});
