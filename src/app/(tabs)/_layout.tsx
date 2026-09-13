import { BlurView } from "expo-blur";
import { Tabs, usePathname } from "expo-router";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { useBlurTarget } from "@/state/blurTarget";
import { useStore } from "@/state/store";
import { c, NAV_H, NAV_INSET, r, squircle } from "@/theme/tokens";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "feed", title: "Feed", icon: "feed" },
  { name: "people", title: "People", icon: "people" },
  { name: "profile", title: "Profile", icon: "profile" },
];

export default function TabsLayout() {
  const { accent, accentSoft } = useStore();
  const insets = useSafeAreaInsets();
  // The root layout wraps every route in the blur target, so the bar blurs the
  // screen it is actually floating over, whichever one that is.
  const blurTarget = useBlurTarget();

  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => pathname === (t.name === "index" ? "/" : `/${t.name}`)),
  );

  // Which slot the highlight sits in, and how wide the row of four actually is —
  // both animate the same rendered indicator regardless of screen width.
  const index = useSharedValue(activeIndex);
  const barWidth = useSharedValue(0);
  useEffect(() => {
    index.value = withTiming(activeIndex, { duration: 260 });
  }, [activeIndex, index]);

  const onBarLayout = (e: LayoutChangeEvent) => {
    barWidth.value = e.nativeEvent.layout.width;
  };

  const indicatorStyle = useAnimatedStyle(() => {
    const slot = barWidth.value / TABS.length;
    const inset = 8;
    return {
      width: Math.max(0, slot - inset * 2),
      left: index.value * slot + inset,
    };
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        sceneStyle: { backgroundColor: c.app },
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: c.textFaint,
        // The four icons are distinct enough to stand on their own, and without
        // labels the pill can be tighter around them.
        tabBarShowLabel: false,
        // `tabBarItemStyle` only reaches an outer wrapper View, not the actual
        // Pressable — that one hard-codes `justifyContent: "flex-start"` (built
        // for an icon-above-label column) with no prop to override it, which is
        // what parked the icon against the top instead of centering it in the
        // bar. Swapping in our own button is the only way to reach that layout.
        tabBarButton: ({ style, children, ref: _ref, ...rest }) => (
          <Pressable {...rest} style={[style, styles.item]}>
            {children}
          </Pressable>
        ),
        tabBarStyle: {
          position: "absolute",
          // The bar's own base style sets logical `start`/`end` (RTL-aware) to 0,
          // which `left`/`right` here do NOT override — different style keys, so
          // both apply and the logical one wins, leaving the bar edge-to-edge no
          // matter what `left`/`right` said. Overriding the same logical keys is
          // what actually pulls the sides in.
          start: NAV_INSET,
          end: NAV_INSET,
          // Measured from the screen edge like the sides are, so all three
          // margins match. The floor only matters on a device whose system bar
          // is taller than the margin (three-button navigation), where sitting
          // underneath it would be worse than being a few points off-square.
          bottom: Math.max(insets.bottom, NAV_INSET),
          height: NAV_H,
          // No padding at all — each of the four equal-width slots centers its
          // own icon, so the outer two land correctly inset from the rounded
          // ends on their own, without reserving extra space that pushes them
          // in further still.
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 0,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          borderRadius: r.full,
          backgroundColor: "transparent",
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill} onLayout={onBarLayout}>
            <BlurView
              tint="dark"
              intensity={92}
              blurTarget={blurTarget}
              blurMethod={
                Platform.OS === "android" && blurTarget
                  ? "dimezisBlurViewSdk31Plus"
                  : undefined
              }
              style={styles.blur}
            />
            {/* Slides between tabs as the route changes — sits behind the icons,
                which are drawn on top of this whole background layer. */}
            <Animated.View style={[styles.indicator, indicatorStyle, { backgroundColor: accentSoft }]} />
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
            tabBarIcon: ({ color, focused }) => (
              <Icon name={t.icon} size={23} color={color} filled={focused} strokeWidth={focused ? 1.2 : 1.6} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blur: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: r.full, overflow: "hidden" },
  item: { justifyContent: "center" },
  indicator: {
    position: "absolute",
    top: 8,
    bottom: 8,
    borderRadius: r.md,
    ...squircle,
  },
});
