import { Tabs, useRouter, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { LiquidGlassSurface } from "@/components/LiquidGlass";
import { PeopleSearchProvider, usePeopleSearch } from "@/state/peopleSearch";
import { c, f, NAV_H, NAV_INSET, NAV_SIDE_INSET, r, s, squircle } from "@/theme/tokens";

// Three equal tabs in the bar, per the handoff — People moves to the
// detached search button instead of sitting as a fourth equal tab.
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "feed", title: "Feed", icon: "feed" },
  { name: "profile", title: "Profile", icon: "profile" },
];

// A circle at the exact same height as the bar reads as visibly bigger next
// to it — a round shape fills its own bounding box more than the bar's
// rounded-pill ends do. A few px smaller is what actually looks the same size.
const SEARCH_SIZE = NAV_H - 6;
const INDICATOR_INSET = 6;
const SPRING = { damping: 22, stiffness: 260, mass: 0.7 } as const;
const MORPH_SPRING = { damping: 24, stiffness: 220, mass: 0.8 } as const;

function TabIndicator({
  activeIndex,
  barWidth,
  dark,
}: {
  activeIndex: number;
  barWidth: number;
  dark: boolean;
}) {
  const segment = barWidth / TABS.length;
  const translateX = useSharedValue(segment * activeIndex);
  const width = useSharedValue(Math.max(segment - INDICATOR_INSET * 2, 0));

  useEffect(() => {
    if (barWidth <= 0) return;
    translateX.value = withSpring(segment * activeIndex + INDICATOR_INSET, SPRING);
    width.value = withTiming(Math.max(segment - INDICATOR_INSET * 2, 0), { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, barWidth]);

  const style = useAnimatedStyle(() => ({
    position: "absolute" as const,
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: 0,
    width: width.value,
    transform: [{ translateX: translateX.value }],
  }));

  if (barWidth <= 0) return null;

  return (
    <Animated.View
      style={[style, styles.indicatorPill, dark && { backgroundColor: "rgba(255,255,255,0.22)" }]}
    />
  );
}

/**
 * The detached search circle morphs into the full-width search field from the
 * Figma handoff's People screen, rather than the two being separate elements.
 * Both states share one right-pinned box: its right edge never moves (it sits
 * at NAV_SIDE_INSET from the screen edge whether collapsed to a circle or
 * expanded to the bar), so only `width` needs to animate — from SEARCH_SIZE
 * up to `barWidth`, which by construction is exactly the width left over once
 * a Home button (see below) takes the circle's old slot on the left.
 */
function SearchMorph({
  onPeople,
  barBottom,
  barWidth,
  tint,
  chromeColor,
}: {
  onPeople: boolean;
  barBottom: number;
  barWidth: number;
  tint: "light" | "dark";
  chromeColor: string;
}) {
  const router = useRouter();
  const { query, setQuery } = usePeopleSearch();
  const progress = useSharedValue(onPeople ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(onPeople ? 1 : 0, MORPH_SPRING);
  }, [onPeople, progress]);

  const boxStyle = useAnimatedStyle(() => ({
    width: SEARCH_SIZE + progress.value * Math.max(0, barWidth - SEARCH_SIZE),
  }));
  const circleStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const barStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      style={[styles.search, { bottom: barBottom + (NAV_H - SEARCH_SIZE) / 2, right: NAV_SIDE_INSET }, boxStyle]}
    >
      <View style={styles.searchClip}>
        <LiquidGlassSurface radius={SEARCH_SIZE / 2} tint={tint} />
      </View>

      <Animated.View style={[styles.fill, circleStyle]} pointerEvents={onPeople ? "none" : "auto"}>
        <Pressable
          onPress={() => router.push("/people")}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Search people"
        >
          <View style={styles.searchCircleIcon}>
            <Icon name="search" size={22} color={chromeColor} />
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.searchBarRow, barStyle]} pointerEvents={onPeople ? "auto" : "none"}>
        <Icon name="search" size={18} color={chromeColor} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={c.textFaint}
          accessibilityLabel="Search people"
          autoCorrect={false}
          style={[styles.searchBarInput, { color: chromeColor }]}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="close" size={16} color={chromeColor} />
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

/** Appears at the circle's old slot (the left edge) once the bar expands —
 * People's way back to Home, replacing the three tabs that hide underneath it.
 *
 * Not animated: a Reanimated-driven opacity/transform on an ancestor of a real
 * native glass surface makes the glass fail to composite — it renders fully
 * invisible (icon still shows fine, since that's plain SVG) even though the
 * exact same LiquidGlassSurface works everywhere else. SearchMorph avoids
 * this by only animating width, never opacity, on the glass's own ancestor —
 * matched here by not animating this element's container at all. */
function PeopleHomeButton({
  onPeople,
  barBottom,
  tint,
  chromeColor,
}: {
  onPeople: boolean;
  barBottom: number;
  tint: "light" | "dark";
  chromeColor: string;
}) {
  const router = useRouter();
  if (!onPeople) return null;

  return (
    <View style={[styles.search, { bottom: barBottom + (NAV_H - SEARCH_SIZE) / 2, left: NAV_SIDE_INSET }]}>
      <View style={styles.searchClip}>
        <LiquidGlassSurface radius={SEARCH_SIZE / 2} tint={tint} />
      </View>
      <Pressable
        onPress={() => router.push("/")}
        style={styles.fill}
        accessibilityRole="button"
        accessibilityLabel="Back to Home"
      >
        <View style={styles.searchCircleIcon}>
          <Icon name="home" size={22} color={chromeColor} />
        </View>
      </Pressable>
    </View>
  );
}

function TabsLayoutInner() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // Sits close to the bottom edge rather than clearing the full home-indicator
  // safe area — just enough gap on either side to read as floating, not the
  // full inset (which left it looking stranded too high up).
  const barBottom = Math.max(NAV_INSET, insets.bottom * 0.35);
  const [barWidth, setBarWidth] = useState(0);
  const onBarLayout = (e: LayoutChangeEvent) => {
    // Keeps the last real measurement once the bar hides on People (see
    // `display: "none"` below) — SearchMorph needs this width throughout.
    if (e.nativeEvent.layout.width > 0) setBarWidth(e.nativeEvent.layout.width);
  };

  const lastIndex = useRef(0);
  const rawIndex = TABS.findIndex((t) => (t.name === "index" ? pathname === "/" : pathname.startsWith(`/${t.name}`)));
  if (rawIndex !== -1) lastIndex.current = rawIndex;
  const activeIndex = rawIndex === -1 ? lastIndex.current : rawIndex;

  const onPeople = pathname === "/people";

  // Feed's reels are full-bleed media — light-tinted glass barely frosts
  // against dark video, so the whole bar (and the search circle) flips to
  // dark-tint glass there, same reasoning as the top rail.
  const onFeed = pathname.startsWith("/feed");
  const tint = onFeed ? "dark" : "light";
  const chromeColor = onFeed ? "#fff" : c.text;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: "shift",
          sceneStyle: { backgroundColor: c.app },
          tabBarActiveTintColor: chromeColor,
          tabBarInactiveTintColor: chromeColor,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: f.xs, fontWeight: "600" },
          // `tabBarItemStyle` only reaches an outer wrapper View, not the actual
          // Pressable inside it — that one hard-codes a fixed border radius, so
          // the active state lives entirely in the sliding TabIndicator instead
          // of a per-item background here.
          tabBarButton: ({ style, children, ref: _ref, ...rest }) => (
            <Pressable {...rest} style={[style, styles.item]}>
              <View style={styles.pill}>{children}</View>
            </Pressable>
          ),
          tabBarStyle: {
            position: "absolute",
            // The bar's own base style sets logical `start`/`end` (RTL-aware) to 0,
            // which `left`/`right` here do NOT override — different style keys, so
            // both apply and the logical one wins, leaving the bar edge-to-edge no
            // matter what `left`/`right` said. Overriding the same logical keys is
            // what actually pulls the sides in.
            start: NAV_SIDE_INSET,
            // Leaves room for the detached search circle, which floats just past
            // the bar's own right edge rather than sitting inside it.
            end: NAV_SIDE_INSET + SEARCH_SIZE + s[2],
            bottom: barBottom,
            height: NAV_H,
            paddingTop: 0,
            paddingBottom: 0,
            paddingHorizontal: 0,
            borderRadius: r.full,
            backgroundColor: "transparent",
            // The library's own base style puts a hairline border across the top
            // of the bar (the stock "line above the tab bar" convention) — our
            // style object never touched borderTopWidth/Color, so that default
            // kept rendering as a stray line of light pixels above our pill.
            borderTopWidth: 0,
            borderTopColor: "transparent",
            elevation: 8,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            // The three tabs hide entirely on People — the search bar takes
            // over their whole slot instead of coexisting with them.
            display: onPeople ? "none" : "flex",
          },
          tabBarBackground: () => (
            <View style={styles.blur} onLayout={onBarLayout}>
              {/* isInteractive real glass has an intermittent bug where it briefly
                  renders solid black instead of its lens effect — static (non-
                  interactive) glass doesn't hit that path and still looks right. */}
              <LiquidGlassSurface radius={r.full} tint={tint} />
              <TabIndicator activeIndex={activeIndex} barWidth={barWidth} dark={onFeed} />
            </View>
          ),
        }}
      >
        {TABS.map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              tabBarIcon: ({ color }) => <Icon name={t.icon} size={24} color={color} filled strokeWidth={1.2} />,
            }}
          />
        ))}
        {/* Still a real route (pushed from the search circle below) — just not
            one of the three equal tabs in the bar. */}
        <Tabs.Screen name="people" options={{ href: null }} />
      </Tabs>

      <PeopleHomeButton onPeople={onPeople} barBottom={barBottom} tint={tint} chromeColor={chromeColor} />
      <SearchMorph
        onPeople={onPeople}
        barBottom={barBottom}
        barWidth={barWidth}
        tint={tint}
        chromeColor={chromeColor}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <PeopleSearchProvider>
      <TabsLayoutInner />
    </PeopleSearchProvider>
  );
}

const styles = StyleSheet.create({
  blur: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: r.full, overflow: "hidden" },
  item: { justifyContent: "center", alignItems: "center" },
  pill: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: s[3],
    paddingVertical: s[2],
    borderRadius: r.full,
    ...squircle,
  },
  indicatorPill: {
    borderRadius: r.full,
    backgroundColor: "rgba(0,0,0,0.14)",
    ...squircle,
  },
  search: {
    position: "absolute",
    width: SEARCH_SIZE,
    height: SEARCH_SIZE,
    borderRadius: r.full,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    ...squircle,
  },
  searchClip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: r.full,
    overflow: "hidden",
  },
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  searchCircleIcon: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchBarRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: s[2],
    paddingHorizontal: s[4],
  },
  searchBarInput: { flex: 1, fontSize: f.sm, paddingVertical: 0 },
});
