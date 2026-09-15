import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { AnimatedStyle } from "react-native-reanimated";

const Wrapped = Animated.createAnimatedComponent(Pressable);

/** Snappy press feedback shared by every tappable surface in the app: shrink in, spring back out. */
export const PRESS_IN_MS = 80;
export const PRESS_OUT_MS = 140;

/**
 * Drop-in replacement for `Pressable` that scales down on press instead of (or alongside)
 * whatever visual state the caller renders. `style` must be a plain style, not the
 * `({ pressed }) => …` render-prop form RN's Pressable also accepts — the scale already
 * carries the pressed feedback.
 */
export function AnimatedPressable({
  scaleTo = 0.94,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Omit<PressableProps, "style"> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle> | (StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>)[];
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Reanimated shared values are mutated by design outside of render; the compiler
  // can't see that `Wrapped` is a plain Pressable and its props aren't called during render.
  const handlePressIn: NonNullable<PressableProps["onPressIn"]> = (e) => {
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(scaleTo, { duration: PRESS_IN_MS });
    onPressIn?.(e);
  };
  const handlePressOut: NonNullable<PressableProps["onPressOut"]> = (e) => {
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(1, { duration: PRESS_OUT_MS });
    onPressOut?.(e);
  };

  return (
    <Wrapped
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animStyle, style]}
      {...rest}
    />
  );
}

/** Per-index stagger for list-entrance animations, capped so long lists don't crawl in. */
export const enterDelay = (index: number, step = 28, max = 8) => Math.min(index, max) * step;
