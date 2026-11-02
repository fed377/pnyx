import type { VotePower } from "@/lib/types";
import { c } from "@/theme/tokens";
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { Icon } from "./Icon";

const BURST_MS = 850;

/**
 * Double-tap a post to Like it. Only ever adds a light Like — never cancels
 * or flips one: a second light tap toward a pending vote *cancels* it in the
 * store (see `vote`), which is the opposite of what a double-tap means. So a
 * post that's already liked (or loved) just replays the burst, and one that's
 * disliked, locked or your own is left alone.
 */
export function useDoubleTapLike({
  current,
  locked,
  own,
  onLike,
}: {
  current?: VotePower;
  locked: boolean;
  own: boolean;
  onLike: (power: VotePower) => void;
}) {
  const burst = useSharedValue(0);

  const like = useCallback(() => {
    if (own) return;
    if (current === undefined) {
      if (locked) return;
      onLike(1);
    } else if (current < 0) {
      return;
    }
    burst.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: BURST_MS })));
  }, [own, current, locked, onLike, burst]);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(20)
    .onEnd((_e, success) => {
      if (success) runOnJS(like)();
    });

  return { doubleTap, burst, like };
}

/** The thumb that pops over a post when a double-tap likes it. */
export function LikeBurst({
  progress,
  size = 96,
  color = c.onAccent,
}: {
  progress: SharedValue<number>;
  size?: number;
  color?: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 0.7, 1], [0, 1, 1, 0], "clamp"),
    transform: [
      { scale: interpolate(progress.value, [0, 0.18, 0.32, 1], [0.3, 1.2, 1, 1.08], "clamp") },
      { translateY: interpolate(progress.value, [0.7, 1], [0, -size * 0.35], "clamp") },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <Animated.View style={[styles.shadow, style]}>
        <Icon name="thumbUp" size={size} color={color} filled />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
