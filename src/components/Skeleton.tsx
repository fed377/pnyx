import { useEffect } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { c, hexToRgba, r, s, squircle, TAB_BAR_CLEARANCE } from "@/theme/tokens";

const PULSE_MS = 900;

/** Translucent ink, so bones read on paper and on the FLOW backdrop alike. */
const BONE = hexToRgba(c.text, 0.09);

/**
 * The shape of what's coming, while it loads. The whole block pulses as one,
 * so its bones never drift out of step; with reduced motion it holds still.
 */
export function Skeleton({
  children,
  style,
  label = "Loading",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(0.45, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduceMotion, pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <Animated.View style={[animated, style]} accessibilityRole="progressbar" accessibilityLabel={label}>
      {children}
    </Animated.View>
  );
}

export function Bone({
  width = "100%",
  height = 12,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: BONE }, squircle, style]} />;
}

/** Text-line widths that vary like real names and captions do, but the same on every render. */
const LINE_WIDTHS: DimensionValue[] = ["62%", "44%", "70%", "52%", "38%", "66%"];
const lineWidth = (i: number) => LINE_WIDTHS[i % LINE_WIDTHS.length];

/** Avatar-and-two-lines rows: people, conversations, notifications, replies. */
export function RowsSkeleton({
  count = 5,
  avatar = 46,
  divided = false,
  label,
}: {
  count?: number;
  avatar?: number;
  divided?: boolean;
  label?: string;
}) {
  return (
    <Skeleton label={label}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.row, divided && i > 0 && styles.rowDivider]}>
          <Bone width={avatar} height={avatar} radius={avatar / 2} />
          <View style={styles.rowBody}>
            <Bone width={lineWidth(i)} height={12} />
            <Bone width={lineWidth(i + 3)} height={10} />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

/** Stand-ins for PostCards on Home: author line, media, caption. */
export function PostsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <Skeleton label="Loading posts" style={{ gap: s[5] }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.post}>
          <View style={styles.postHead}>
            <Bone width={36} height={36} radius={18} />
            <View style={styles.rowBody}>
              <Bone width={lineWidth(i)} height={12} />
              <Bone width="28%" height={10} />
            </View>
          </View>
          <Bone height={i % 2 === 0 ? 280 : 200} radius={r.md} />
          <Bone width="86%" height={12} />
          <Bone width={lineWidth(i + 2)} height={12} />
        </View>
      ))}
    </Skeleton>
  );
}

/** Hot take circles on Home, after the "New" button. */
export function TakesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Skeleton label="Loading hot takes" style={styles.takes}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.take}>
          <Bone width={64} height={64} radius={32} />
          <Bone width={44} height={9} />
        </View>
      ))}
    </Skeleton>
  );
}

/** One reel page: caption and author at the bottom left, the vote rail on the right. */
export function ReelSkeleton({ height }: { height: number }) {
  return (
    <Skeleton label="Loading reels" style={[styles.reel, { height }]}>
      <View style={styles.reelInfo}>
        <View style={styles.postHead}>
          <Bone width={36} height={36} radius={18} />
          <Bone width={120} height={12} />
        </View>
        <Bone width="88%" height={12} />
        <Bone width="60%" height={12} />
      </View>
      <View style={styles.reelRail}>
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} width={52} height={52} radius={26} />
        ))}
      </View>
    </Skeleton>
  );
}

/** A profile's header block while the person is fetched. */
export function ProfileSkeleton() {
  return (
    <Skeleton label="Loading profile" style={{ gap: s[5] }}>
      <View style={styles.postHead}>
        <Bone width={84} height={84} radius={42} />
        <View style={styles.rowBody}>
          <Bone width="70%" height={20} radius={8} />
          <Bone width="50%" height={12} />
          <Bone width="40%" height={10} />
        </View>
      </View>
      <Bone height={72} radius={r.md} />
      <View style={{ gap: s[2] }}>
        <Bone width="92%" height={12} />
        <Bone width="64%" height={12} />
      </View>
      <View style={styles.tiles}>
        {[0, 1, 2].map((i) => (
          <Bone key={i} height={120} radius={r.sm} style={styles.tile} />
        ))}
      </View>
    </Skeleton>
  );
}

/** A conversation's bubbles, alternating sides like a real thread. */
export function BubblesSkeleton() {
  const bubbles: { mine: boolean; w: DimensionValue; h: number }[] = [
    { mine: false, w: "58%", h: 40 },
    { mine: true, w: "46%", h: 40 },
    { mine: false, w: "70%", h: 58 },
    { mine: true, w: "52%", h: 40 },
  ];
  return (
    <Skeleton label="Loading messages" style={{ gap: s[3] }}>
      {bubbles.map((b, i) => (
        <Bone key={i} width={b.w} height={b.h} radius={r.md} style={b.mine && styles.mine} />
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: s[3], paddingVertical: s[3] },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.lineSoft },
  rowBody: { flex: 1, gap: s[2] },
  post: { gap: s[3] },
  postHead: { flexDirection: "row", alignItems: "center", gap: s[3] },
  takes: { flexDirection: "row", gap: s[4] },
  take: { alignItems: "center", gap: 6, width: 64 },
  reel: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: s[3],
    paddingHorizontal: s[4],
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  reelInfo: { flex: 1, gap: s[2] },
  reelRail: { gap: s[4], alignItems: "center" },
  tiles: { flexDirection: "row", gap: s[2] },
  tile: { flex: 1 },
  mine: { alignSelf: "flex-end" },
});
