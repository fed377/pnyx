import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";

/**
 * For a screen whose form sits in a ScrollView. On iOS the ScrollView handles
 * the keyboard itself (see FORM_SCROLL_PROPS), and it only scrolls the focused
 * field into view if the keyboard really overlaps it — shrinking the screen
 * with KeyboardAvoidingView as well would stop that. Android has no such prop.
 */
export const FORM_KEYBOARD_BEHAVIOR = Platform.OS === "android" ? ("padding" as const) : undefined;

/** Keeps the focused field above the keyboard, and doesn't bounce unless there's more to see. */
export const FORM_SCROLL_PROPS = {
  automaticallyAdjustKeyboardInsets: true,
  keyboardShouldPersistTaps: "handled",
  alwaysBounceVertical: false,
} as const;

const FALLBACK_MS = 250;

/** The keyboard's height: `height` for layout, `animated` to move along with it. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  const animated = useSharedValue(0);

  useEffect(() => {
    const apply = (next: number, duration?: number) => {
      setHeight(next);
      animated.set(withTiming(next, { duration: duration || FALLBACK_MS, easing: Easing.out(Easing.cubic) }));
    };
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      apply(e.endCoordinates.height, e.duration),
    );
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (e) => apply(0, e.duration));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [animated]);

  return { height, animated };
}
