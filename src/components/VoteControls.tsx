import type { VotePower } from "@/lib/types";
import { c, f, s } from "@/theme/tokens";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Icon } from "./Icon";

/** Press-and-hold duration for Love / Hate (spec §4.1). */
export const HOLD_MS = 1500;
/**
 * Vertical rhythm of the reel rail. Exported so the buttons the rail adds
 * around this one (comments, share) keep the same spacing instead of drifting.
 */
export const RAIL_GAP = s[3];
/** Gap between a rail glyph and the label under it. */
export const RAIL_LABEL_GAP = 4;
/** Point in the hold where the icon flips to the strong reaction. */
const PREVIEW_AT = 0.55;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Dir = 1 | -1;

/** Pops the glyph the moment a direction settles as the current vote — a vote should land with a beat. */
function usePop(active: boolean) {
  const scale = useSharedValue(1);
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) {
      scale.value = withSequence(
        withTiming(1.3, { duration: 90 }),
        withSpring(1, { damping: 9, stiffness: 220 }),
      );
    }
    was.current = active;
  }, [active, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

export function VoteControls({
  current,
  pendingUntil,
  onVote,
  layout = "row",
  size = 42,
  disabled = false,
  onDisabledPress,
  locked = false,
  onLockedPress,
  overlay = false,
}: {
  current?: VotePower;
  /** Timestamp this content's pending vote commits at, if one is pending. */
  pendingUntil?: number;
  onVote: (power: VotePower) => void;
  layout?: "row" | "rail";
  size?: number;
  disabled?: boolean;
  onDisabledPress?: () => void;
  /** The vote has committed and can no longer be changed. */
  locked?: boolean;
  onLockedPress?: () => void;
  /** Sits on top of a reel, so the buttons need their own contrast. */
  overlay?: boolean;
}) {
  const [holding, setHolding] = useState<Dir | null>(null);
  const [preview, setPreview] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const pendingProgress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const pendingAnim = useRef<Animated.CompositeAnimation | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(false);
  const popUp = usePop(current === 2 || current === 1);
  const popDown = usePop(current === -2 || current === -1);

  // Fills over whatever time is left until the pending vote commits — if this
  // mounts mid-window (scrolled back to a reel voted on earlier), it fills
  // over just the remainder rather than the full grace period.
  useEffect(() => {
    pendingAnim.current?.stop();
    if (pendingUntil === undefined) {
      pendingProgress.setValue(0);
      return;
    }
    const remaining = Math.max(0, pendingUntil - Date.now());
    pendingProgress.setValue(0);
    pendingAnim.current = Animated.timing(pendingProgress, {
      toValue: 1,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    pendingAnim.current.start();
    // pendingProgress is a stable ref value (same Animated.Value instance for
    // the component's lifetime) — it never needs to be a dependency here.
  }, [pendingUntil]);

  const clearTimers = useCallback(() => {
    anim.current?.stop();
    anim.current = null;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const commit = useCallback(
    (power: VotePower) => {
      committed.current = true;
      clearTimers();
      setHolding(null);
      setPreview(false);
      progress.setValue(0);
      onVote(power);
    },
    [clearTimers, onVote, progress],
  );

  const begin = useCallback(
    (dir: Dir) => {
      if (disabled) return;
      if (committed.current) return;
      committed.current = false;
      setHolding(dir);
      setPreview(false);
      progress.setValue(0);
      previewTimer.current = setTimeout(
        () => setPreview(true),
        HOLD_MS * PREVIEW_AT,
      );
      anim.current = Animated.timing(progress, {
        toValue: 1,
        duration: HOLD_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      anim.current.start(({ finished }) => {
        if (finished) commit(dir === 1 ? 2 : -2);
      });
    },
    [commit, disabled, progress],
  );

  const release = useCallback(
    (dir: Dir) => {
      if (disabled) return;
      clearTimers();
      setHolding(null);
      setPreview(false);
      progress.setValue(0);
      if (!committed.current) commit(dir === 1 ? 1 : -1);
    },
    [clearTimers, commit, disabled, progress],
  );

  // On the rail the button box hugs the glyph, so the gaps in the stylesheet
  // are the gaps you see; the padding that would have made the target big
  // enough moves into hitSlop instead.
  const glyph = Math.round(size * 0.6);
  const box = layout === "rail" ? glyph : size;
  const slop = Math.round((size - box) / 2);

  const ringR = box / 2 + 2;
  const circ = 2 * Math.PI * ringR;

  const renderButton = (dir: Dir) => {
    const strong: VotePower = dir === 1 ? 2 : -2;
    const light: VotePower = dir === 1 ? 1 : -1;
    const active = current === strong || current === light;
    const isStrong = current === strong;
    const isHolding = holding === dir;
    const isPending = active && pendingUntil !== undefined;
    const tone = dir === 1 ? c.up : c.down;

    const showStrongIcon = isStrong || (isHolding && preview);
    const iconName = showStrongIcon
      ? dir === 1
        ? "heart"
        : "heartBreak"
      : dir === 1
        ? "thumbUp"
        : "thumbDown";

    const label = isStrong
      ? dir === 1
        ? "Loved"
        : "Hated"
      : active
        ? dir === 1
          ? "Liked"
          : "Disliked"
        : dir === 1
          ? "Like"
          : "Dislike";

    // No chrome around the button, and no colour on the glyph either — a vote
    // reads as a *filled* icon rather than a tinted one. The progress ring is
    // the only thing that carries the direction's colour.
    const fg = overlay ? "#fff" : active || isHolding ? c.text : c.textDim;
    // A settled vote keeps its full presence; the road not taken fades out.
    const opacity = disabled ? 0.35 : locked && !active ? 0.28 : 1;

    return (
      <View key={dir} style={styles.slot}>
        <Pressable
          // Pressable's own `disabled` swallows the press outright, which would
          // also swallow the chance to explain why nothing happened.
          onPressIn={() => {
            if (disabled) return onDisabledPress?.();
            if (locked) return onLockedPress?.();
            begin(dir);
          }}
          onPressOut={() => {
            if (disabled || locked) return;
            release(dir);
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || locked, selected: active }}
          accessibilityLabel={
            locked
              ? active
                ? `${label}. This vote is final.`
                : `${dir === 1 ? "Like" : "Dislike"} — unavailable, your vote is already counted.`
              : isPending
                ? `${dir === 1 ? "Liked" : "Disliked"}, not yet final. Tap again to cancel.`
                : `${dir === 1 ? "Like" : "Dislike"}. Tap to ${
                    dir === 1 ? "like" : "dislike"
                  }, hold for one and a half seconds to ${dir === 1 ? "love" : "hate"}.`
          }
          hitSlop={slop}
          style={[styles.btn, { width: box, height: box, opacity }]}
        >
          {(isHolding || isPending) && (
            <View style={[StyleSheet.absoluteFill, styles.ring]}>
              <Svg
                width={ringR * 2 + 6}
                height={ringR * 2 + 6}
                viewBox={`0 0 ${ringR * 2 + 6} ${ringR * 2 + 6}`}
              >
                <AnimatedCircle
                  cx={ringR + 3}
                  cy={ringR + 3}
                  r={ringR}
                  fill="none"
                  stroke={tone}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={`${circ}`}
                  strokeDashoffset={(isHolding
                    ? progress
                    : pendingProgress
                  ).interpolate({
                    inputRange: [0, 1],
                    outputRange: [circ, 0],
                  })}
                  transform={`rotate(-90 ${ringR + 3} ${ringR + 3})`}
                />
              </Svg>
            </View>
          )}
          <Reanimated.View style={dir === 1 ? popUp : popDown}>
            <Icon
              name={iconName}
              size={glyph}
              color={fg}
              filled={active || isHolding}
            />
          </Reanimated.View>
        </Pressable>
        {layout === "rail" && <Text style={styles.caption}>{label}</Text>}
      </View>
    );
  };

  return (
    <View style={layout === "rail" ? styles.rail : styles.row}>
      {renderButton(1)}
      {renderButton(-1)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: s[2] },
  rail: { flexDirection: "column", alignItems: "center", gap: RAIL_GAP },
  slot: { alignItems: "center", gap: RAIL_LABEL_GAP },
  btn: { alignItems: "center", justifyContent: "center" },
  ring: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  caption: {
    color: "rgba(236,237,243,0.85)",
    fontSize: f.xs,
    fontWeight: "500",
  },
});
