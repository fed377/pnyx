import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { s } from "@/theme/tokens";

const CLOSE_DRAG = 120;
const CLOSE_VELOCITY = 800;

/**
 * Full-screen black chrome shared by the Hot Take viewer and the Photo
 * viewer: a progress bar (one segment per item, no auto-advance timer —
 * these aren't ephemeral timed stories, just a tap-paged carousel), a close
 * button, an "i / N" counter, left/right tap zones to page through, and a
 * swipe-down-to-close drag on the whole card.
 */
export function StoryShell({
  open,
  index,
  count,
  onIndexChange,
  onClose,
  media,
  center,
  children,
}: {
  open: boolean;
  index: number;
  count: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Full-bleed background — a photo, or nothing for a plain black take. */
  media?: React.ReactNode;
  /** Content centered in the full screen, behind the bottom card — the Hot
   * Take's large quote text, say. Separate from `children` so it doesn't get
   * pulled down into the bottom-pinned card slot with it. */
  center?: React.ReactNode;
  /** The bottom info card — chip, author, reactions, timestamp. */
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (open) translateY.value = 0;
  }, [open, translateY]);

  const go = (delta: 1 | -1) => {
    const next = index + delta;
    if (next < 0 || next >= count) {
      onClose();
      return;
    }
    onIndexChange(next);
  };

  // `activeOffsetY` means a quick tap never "claims" the gesture — only a
  // real vertical drag does — so the prev/next tap zones underneath still work.
  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared-value
      // mutation on the UI thread, not React state; the compiler's static rule can't
      // tell the two apart (same suppression already used in AnimatedPressable).
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DRAG || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(onClose)();
      } else {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withSpring(0, { damping: 20, stiffness: 260 });
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={open} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.fill, dragStyle]}>
            {media}

            <View style={styles.tapZones} pointerEvents="box-none">
              <Pressable style={styles.tapZone} onPress={() => go(-1)} accessibilityLabel="Previous" />
              <Pressable style={styles.tapZone} onPress={() => go(1)} accessibilityLabel="Next" />
            </View>

            {center && (
              <View style={styles.centerSlot} pointerEvents="none">
                {center}
              </View>
            )}

            <View style={styles.bottomSlot} pointerEvents="box-none">
              {children}
            </View>
          </Animated.View>
        </GestureDetector>

        <View style={[styles.top, { paddingTop: insets.top + s[2] }]} pointerEvents="box-none">
          <View style={styles.progressRow}>
            {Array.from({ length: count }).map((_, i) => (
              <View key={i} style={styles.segmentTrack}>
                <View style={[styles.segmentFill, i <= index && styles.segmentFillDone]} />
              </View>
            ))}
          </View>
          <View style={styles.topRow}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
            <Text style={styles.counter}>
              {index + 1} / {count}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  tapZones: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row" },
  tapZone: { flex: 1 },
  centerSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: s[4],
  },
  bottomSlot: { position: "absolute", left: 0, right: 0, bottom: 0 },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: s[3], gap: s[3] },
  progressRow: { flexDirection: "row", gap: 4 },
  segmentTrack: { flex: 1, height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  segmentFill: { flex: 1, backgroundColor: "transparent" },
  segmentFillDone: { backgroundColor: "#fff" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
});
