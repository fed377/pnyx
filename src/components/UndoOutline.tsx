import { VOTE_GRACE_MS } from "@/lib/algorithm";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Reanimated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";

const AnimatedRect = Reanimated.createAnimatedComponent(Rect);

const STROKE = 2.5;
/** Room around the shape so the stroke's round caps aren't clipped. */
const PAD = STROKE;

/**
 * Traces the button's edge and drains as a pending vote's undo window runs
 * out. Measures its parent, so one shape covers the round buttons and the
 * labeled pill, including when the pill's text changes width.
 */
export function UndoOutline({
  commitAt,
  color,
  outset,
}: {
  commitAt: number;
  color: string;
  /** How far outside the parent's padding box the line runs. */
  outset: number;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const left = useSharedValue(1);

  useEffect(() => {
    // Mounting mid-window (scrolled back to a post voted on earlier) picks up
    // at the time actually left rather than restarting from full.
    const remaining = Math.max(0, commitAt - Date.now());
    left.set(Math.min(1, remaining / VOTE_GRACE_MS));
    // This is a clock, not decoration: with reduced motion on it still has to
    // show the time left, instead of jumping straight to empty.
    left.set(withTiming(0, { duration: remaining, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(left);
  }, [commitAt, left]);

  const width = box.width + outset * 2;
  const height = box.height + outset * 2;
  const radius = Math.min(width, height) / 2;
  // Fully rounded, so the corners add up to one circle.
  const perimeter = 2 * (width + height - 4 * radius) + 2 * Math.PI * radius;

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: perimeter * (1 - left.get()) }));

  const svgWidth = width + PAD * 2;
  const svgHeight = height + PAD * 2;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.wrap]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setBox({ width: w, height: h });
      }}
    >
      {box.width > 0 && (
        <Svg width={svgWidth} height={svgHeight}>
          <AnimatedRect
            x={PAD}
            y={PAD}
            width={width}
            height={height}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${perimeter} ${perimeter}`}
            animatedProps={animatedProps}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "visible" },
});
