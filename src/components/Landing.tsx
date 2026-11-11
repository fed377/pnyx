import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GRIDS, nearestPoint } from "@/lib/grids";
import type { Positions } from "@/lib/types";
import { c, display, f, s } from "@/theme/tokens";
import { Crest } from "./Crest";
import { Btn } from "./Primitives";

/** Soul (highlight), Focus (plate) and Mind held constant across the rotation —
 * only the animal and its colour change, so it reads as a showcase, not noise. */
const FIXED: Pick<Positions, "soul" | "focus" | "mind"> = {
  soul: { x: 0, y: 0 },
  focus: { x: 0, y: 0 },
  mind: { x: 0, y: 0 },
};

/** Every animal once. Stepping through the 13 points by these (coprime) strides
 * visits all of them while keeping neighbours in the rotation unalike. */
const FRAMES: Positions[] = GRIDS.values.points.map((_, i) => {
  const animal = GRIDS.values.points[(i * 5) % GRIDS.values.points.length]!;
  const colour = GRIDS.culture.points[(i * 8) % GRIDS.culture.points.length]!;
  return { values: { x: animal.x, y: animal.y }, culture: { x: colour.x, y: colour.y }, ...FIXED };
});

const CREST_SIZE = 148;
const LABEL_H = 16;
const HOLD_MS = 2200;
const FADE_MS = 450;

function AnimalFrame({ positions, active }: { positions: Positions; active: boolean }) {
  const opacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    opacity.set(withTiming(active ? 1 : 0, { duration: FADE_MS, easing: Easing.inOut(Easing.quad) }));
  }, [active, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const animal = nearestPoint("values", positions.values).animal ?? "dragon";

  return (
    <Animated.View style={[styles.frame, style]} accessibilityElementsHidden={!active}>
      <Crest positions={positions} size={CREST_SIZE} dot={false} />
      <Text style={styles.previewLabel}>{animal[0]!.toUpperCase() + animal.slice(1)}</Text>
    </Animated.View>
  );
}

/**
 * All the frames stay mounted and crossfade. Swapping one Crest's animal
 * instead would start loading the new image while the fade was already
 * running, so it popped in a beat late.
 */
export function AnimalPreview() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % FRAMES.length), HOLD_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.preview}>
      {FRAMES.map((positions, i) => (
        <AnimalFrame key={i} positions={positions} active={i === index} />
      ))}
    </View>
  );
}

export function Landing({ onContinue }: { onContinue: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s[7], paddingBottom: insets.bottom + s[5] }]}>
      <View style={styles.top}>
        <Text style={styles.wordmark}>PNYX</Text>
        <Text style={styles.tagline}>Everyone should know what everyone really thinks.</Text>
      </View>

      <AnimalPreview />

      <View style={styles.bottom}>
        <Text style={styles.explain}>
          Every reaction you cast shapes a private, ever-moving type — a color, an animal, a shape only you can
          see the full picture of.
        </Text>
        <Btn label="Get started" variant="accent" wide onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app, paddingHorizontal: s[5], justifyContent: "space-between" },
  top: { gap: s[2] },
  wordmark: { color: c.text, fontSize: 30, fontFamily: display.bold, letterSpacing: 6 },
  tagline: { color: c.textDim, fontSize: f.md, lineHeight: 22, maxWidth: 320 },
  preview: { height: CREST_SIZE + s[3] + LABEL_H },
  frame: { position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", gap: s[3] },
  previewLabel: {
    color: c.textFaint,
    fontSize: f.xs,
    lineHeight: LABEL_H,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  bottom: { gap: s[4] },
  explain: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
});
