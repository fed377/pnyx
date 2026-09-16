import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nearestPoint } from "@/lib/grids";
import type { Positions } from "@/lib/types";
import { c, display, f, s } from "@/theme/tokens";
import { Crest } from "./Crest";
import { Btn } from "./Primitives";

/** A handful of (Values, Culture) coordinate pairs, chosen for a varied,
 * good-looking rotation — not meant to be exhaustive, just a taste of the
 * identity system before anyone has an account to generate their own. */
const PREVIEW: { values: { x: number; y: number }; culture: { x: number; y: number } }[] = [
  { values: { x: 1, y: 1 }, culture: { x: -1, y: -1 } }, // wolf, electric
  { values: { x: -0.66, y: -0.66 }, culture: { x: 1, y: 1 } }, // owl, gold
  { values: { x: 0, y: 0 }, culture: { x: -0.33, y: -0.33 } }, // dragon, lilac
  { values: { x: -1, y: 1 }, culture: { x: 1, y: -1 } }, // fox, cyan
  { values: { x: 0.66, y: 0.66 }, culture: { x: -0.33, y: 0.33 } }, // lion, sage
];

/** Soul (highlight) and Focus (plate) held constant across the rotation —
 * varying five things at once would read as noise, not a showcase. */
const FIXED: Pick<Positions, "soul" | "focus" | "mind"> = {
  soul: { x: 0, y: 0 },
  focus: { x: 0, y: 0 },
  mind: { x: 0, y: 0 },
};

function positionsFor(i: number): Positions {
  const p = PREVIEW[i % PREVIEW.length]!;
  return { values: p.values, culture: p.culture, ...FIXED };
}

const HOLD_MS = 2200;
const FADE_MS = 220;

function AnimalPreview() {
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    let fadeInTimer: ReturnType<typeof setTimeout> | null = null;
    const id = setInterval(() => {
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.cubic) });
      fadeInTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % PREVIEW.length);
        opacity.value = withTiming(1, { duration: FADE_MS * 1.3, easing: Easing.out(Easing.cubic) });
      }, FADE_MS);
    }, HOLD_MS);
    return () => {
      clearInterval(id);
      if (fadeInTimer) clearTimeout(fadeInTimer);
    };
  }, [opacity]);

  const positions = positionsFor(index);
  const animalLabel = nearestPoint("values", positions.values).animal ?? "dragon";
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.preview, style]}>
      <Crest positions={positions} size={148} dot={false} />
      <Text style={styles.previewLabel}>{animalLabel[0]!.toUpperCase() + animalLabel.slice(1)}</Text>
    </Animated.View>
  );
}

export function Landing({ onContinue, onSkip }: { onContinue: () => void; onSkip?: () => void }) {
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
        {onSkip && (
          <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>Explore the sample profile without an account</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app, paddingHorizontal: s[5], justifyContent: "space-between" },
  top: { gap: s[2] },
  wordmark: { color: c.text, fontSize: 30, fontFamily: display.bold, letterSpacing: 6 },
  tagline: { color: c.textDim, fontSize: f.md, lineHeight: 22, maxWidth: 320 },
  preview: { alignItems: "center", gap: s[3] },
  previewLabel: {
    color: c.textFaint,
    fontSize: f.xs,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  bottom: { gap: s[4] },
  explain: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
  skip: { alignItems: "center" },
  skipText: { color: c.textFaint, fontSize: f.sm, textDecorationLine: "underline" },
});
