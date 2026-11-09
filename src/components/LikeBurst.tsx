import type { VotePower } from "@/lib/types";
import { c } from "@/theme/tokens";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "./Icon";

const BURST_MS = 900;
/** Point in the burst where the pop has settled and the thumb takes off. */
const FLY_AT = 0.28;
const BURST_SIZE = 96;
/** Above the launch cover and banners, which also sit over the navigator. */
const TOP_LAYER = 1000;

type Fire = (x: number, y: number) => void;

const FireBurst = createContext<Fire>(() => {});

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
  const fire = useContext(FireBurst);

  const like = useCallback(
    (x: number, y: number) => {
      if (own) return;
      if (current === undefined) {
        if (locked) return;
        onLike(1);
      } else if (current < 0) {
        return;
      }
      fire(x, y);
    },
    [own, current, locked, onLike, fire],
  );

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(20)
    .onEnd((e, success) => {
      if (success) runOnJS(like)(e.absoluteX, e.absoluteY);
    });

  return { doubleTap };
}

/**
 * Draws bursts at screen coordinates in a layer above `children`, so nothing
 * in the app covers or clips them. The root has one; a Modal is its own native
 * window on top of the root, so anything double-tappable inside one needs its own.
 */
export function LikeBurstHost({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const nextId = useRef(0);

  const fire = useCallback<Fire>((x, y) => {
    const id = nextId.current++;
    setBursts((b) => [...b, { id, x, y }]);
  }, []);

  const remove = useCallback((id: number) => {
    setBursts((b) => b.filter((burst) => burst.id !== id));
  }, []);

  return (
    <FireBurst.Provider value={fire}>
      {children}
      <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
        {bursts.map((b) => (
          <Burst key={b.id} id={b.id} x={b.x} y={b.y} onDone={remove} />
        ))}
      </View>
    </FireBurst.Provider>
  );
}

/** The thumb that pops at the tap when a double-tap likes a post. */
function Burst({
  id,
  x,
  y,
  onDone,
}: {
  id: number;
  x: number;
  y: number;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withTiming(1, { duration: BURST_MS }, (finished) => {
        if (finished) runOnJS(onDone)(id);
      }),
    );
  }, [progress, id, onDone]);

  // Alternates, so a run of quick double-taps fans out instead of stacking.
  const side = id % 2 === 0 ? 1 : -1;
  // Scaled up by the time it leaves, so it needs a little past its own height.
  const distance = y + BURST_SIZE * 1.2;

  // Visible from the first frame: the pop is the entrance, with no fade-in.
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const flight = interpolate(p, [FLY_AT, 1], [0, 1], "clamp");
    // Squared, so it hangs for a moment and then accelerates away.
    const lift = flight * flight;
    const tilt = interpolate(p, [0, 0.08, 0.2, 1], [0, side * -14, side * -6, side * 28], "clamp");
    return {
      transform: [
        { translateX: side * Math.sin(flight * Math.PI) * BURST_SIZE * 0.4 },
        { translateY: -lift * distance },
        { rotate: `${tilt}deg` },
        { scale: interpolate(p, [0, 0.08, 0.2, FLY_AT, 1], [0.7, 1.35, 1, 1, 1.3], "clamp") },
      ],
    };
  });

  return (
    <Animated.View style={[styles.burst, { left: x - BURST_SIZE / 2, top: y - BURST_SIZE / 2 }, style]}>
      <Icon name="thumbUp" size={BURST_SIZE} color={c.up} filled />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: TOP_LAYER, elevation: TOP_LAYER },
  burst: {
    position: "absolute",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
