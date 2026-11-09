import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { c, display, f, s } from "@/theme/tokens";

const DOTS = [0, 1, 2, 3, 4];
const CYCLE_MS = 1300;
/** How far behind the previous dot each one starts moving, as a share of the cycle. */
const STAGGER = 0.07;
/** A quarter-turn or so over one gather, so the dots spiral in rather than march. */
const TWIST = 1.4;
/** A cold API instance can take tens of seconds; only say so once it's actually slow. */
const SLOW_AFTER_MS = 6000;

function Dot({
  index,
  progress,
  radius,
  dot,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  radius: number;
  dot: number;
  color: string;
}) {
  const start = -Math.PI / 2 + (index * 2 * Math.PI) / DOTS.length;

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const span = 1 - STAGGER * (DOTS.length - 1);
    const t = Math.min(1, Math.max(0, (p - index * STAGGER) / span));
    const angle = start + p * TWIST;
    const r = radius * (1 - t);
    return {
      opacity: 0.4 + 0.6 * t,
      transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r }, { scale: 1 + 0.5 * t }],
    };
  });

  return (
    <Animated.View
      style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }, style]}
    />
  );
}

/**
 * Five dots gathering into one and letting go: the five grids resolving into a
 * single identity, which is the whole product. With reduced motion on, they
 * simply hold still in their ring.
 */
export function LoadingMark({ size = 32, color = c.text }: { size?: number; color?: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.inOut(Easing.cubic) }), -1, true));
  }, [reduceMotion, progress]);

  const dot = Math.max(4, Math.round(size * 0.17));
  const radius = (size - dot) / 2;

  return (
    <View style={[styles.mark, { width: size, height: size }]}>
      {DOTS.map((i) => (
        <Dot key={i} index={i} progress={progress} radius={radius} dot={dot} color={color} />
      ))}
    </View>
  );
}

/** For a screen or sheet waiting on its first load of data. */
export function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.inline, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <LoadingMark />
    </View>
  );
}

/**
 * Covers the app while it opens. The wordmark sits exactly where the start
 * screen has it, so handing over to that screen doesn't move anything.
 */
export function LaunchScreen() {
  const insets = useSafeAreaInsets();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <Animated.View
      exiting={FadeOut.duration(260)}
      style={[
        StyleSheet.absoluteFill,
        styles.launch,
        { paddingTop: insets.top + s[7], paddingBottom: insets.bottom + s[5] },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Opening PNYX"
    >
      <Text style={styles.wordmark}>PNYX</Text>
      <View style={styles.center}>
        <LoadingMark size={72} />
      </View>
      <View style={styles.foot}>
        {slow && (
          <Animated.Text entering={FadeIn.duration(320)} style={styles.slow}>
            Still connecting. This can take up to a minute.
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute" },
  inline: { alignItems: "center", justifyContent: "center", paddingVertical: s[2] },
  launch: { backgroundColor: c.app, paddingHorizontal: s[5], zIndex: 40 },
  wordmark: { color: c.text, fontSize: 30, fontFamily: display.bold, letterSpacing: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  foot: { minHeight: 20, alignItems: "center" },
  slow: { color: c.textFaint, fontSize: f.sm, textAlign: "center" },
});
