import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { c, display, f, r, s, squircle } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Icon } from "./Icon";

const SCREEN_H = Dimensions.get("window").height;
const DURATION_IN = 260;
const DURATION_OUT = 200;

export function Sheet({
  open,
  title,
  onClose,
  children,
  closeLabel,
  /** Inset on all sides with fully-rounded corners, rather than flush against
   * the bottom edge with only the top corners rounded. */
  floating = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** A text button ("Done") instead of the default X close icon. */
  closeLabel?: string;
  floating?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Kept mounted through the close animation — RN's Modal has no exit
  // transition of its own once `visible` flips false, so unmounting on
  // `open` directly would cut the animation off mid-flight.
  const [mounted, setMounted] = useState(open);
  // Scrim and sheet animate on separate values rather than one shared "slide"
  // transform: driving both off a single Animated.View (what RN's built-in
  // `animationType="slide"` does) drags the scrim along with the sheet's
  // translateY, so the dim only ever *covers* the screen once the slide
  // finishes, instead of smoothly fading in over the whole screen the moment
  // the sheet opens.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, { duration: DURATION_IN, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: DURATION_OUT, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [open, progress]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * SCREEN_H }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.layer}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            floating && [styles.sheetFloating, { marginBottom: Math.max(s[4], insets.bottom) }],
            sheetStyle,
          ]}
        >
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            {closeLabel ? (
              <AnimatedPressable onPress={onClose} hitSlop={8} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={closeLabel}>
                <Text style={styles.closeLabel}>{closeLabel}</Text>
              </AnimatedPressable>
            ) : (
              <AnimatedPressable onPress={onClose} hitSlop={8} scaleTo={0.85} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={20} color={c.text} />
              </AnimatedPressable>
            )}
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.scrim },
  sheet: {
    maxHeight: "78%",
    backgroundColor: c.surface,
    borderTopLeftRadius: r.lg,
    borderTopRightRadius: r.lg,
    ...squircle,
  },
  sheetFloating: {
    marginHorizontal: s[3],
    borderBottomLeftRadius: r.lg,
    borderBottomRightRadius: r.lg,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: s[4],
    paddingRight: s[3],
    paddingVertical: s[3],
    borderBottomWidth: 1,
    borderBottomColor: c.lineSoft,
  },
  title: { color: c.text, fontSize: f.md, fontFamily: display.semibold },
  closeLabel: { color: c.textDim, fontSize: f.sm, fontWeight: "600" },
  body: { padding: s[4], paddingBottom: s[6] },
});
