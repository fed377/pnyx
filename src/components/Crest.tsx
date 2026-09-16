import { Image } from "expo-image";
import type { ImageSource } from "expo-image";
import { StyleSheet, View } from "react-native";
import { nearestPoint } from "@/lib/grids";
import type { AnimalId, Positions } from "@/lib/types";
import { c, hexToRgba } from "@/theme/tokens";

/**
 * The identity icon (spec §3.1). Every grid contributes one visual feature:
 *   Values  → which animal
 *   Culture → animal base colour
 *   Soul    → animal highlight colour
 *   Focus   → animal shadow colour (the plate behind it)
 *   Mind    → primary colour + the profile dot
 *
 * The animal art itself is two alpha-masked template layers per animal (a
 * "base" silhouette and an enclosed "highlight" region — the face patch, on
 * every one of these), each recoloured per-user via `tintColor` rather than
 * drawn as flat-colour SVG paths. Generated once, offline, from the flat
 * black-on-white source art in .icons/animals: everything below the ink
 * threshold becomes the base layer's alpha mask, and any white region fully
 * enclosed by ink (not touching the image border) becomes the highlight
 * layer's — the same two-tone split the original hand-drawn paths used.
 */

const ANIMAL_LAYERS: Record<AnimalId, { base: ImageSource; highlight: ImageSource }> = {
  wolf: { base: require("../../assets/images/animals/wolf-base.png"), highlight: require("../../assets/images/animals/wolf-highlight.png") },
  fox: { base: require("../../assets/images/animals/fox-base.png"), highlight: require("../../assets/images/animals/fox-highlight.png") },
  bear: { base: require("../../assets/images/animals/bear-base.png"), highlight: require("../../assets/images/animals/bear-highlight.png") },
  lion: { base: require("../../assets/images/animals/lion-base.png"), highlight: require("../../assets/images/animals/lion-highlight.png") },
  eagle: { base: require("../../assets/images/animals/eagle-base.png"), highlight: require("../../assets/images/animals/eagle-highlight.png") },
  deer: { base: require("../../assets/images/animals/deer-base.png"), highlight: require("../../assets/images/animals/deer-highlight.png") },
  owl: { base: require("../../assets/images/animals/owl-base.png"), highlight: require("../../assets/images/animals/owl-highlight.png") },
  turtle: { base: require("../../assets/images/animals/turtle-base.png"), highlight: require("../../assets/images/animals/turtle-highlight.png") },
  fish: { base: require("../../assets/images/animals/fish-base.png"), highlight: require("../../assets/images/animals/fish-highlight.png") },
  capybara: { base: require("../../assets/images/animals/capybara-base.png"), highlight: require("../../assets/images/animals/capybara-highlight.png") },
  bull: { base: require("../../assets/images/animals/bull-base.png"), highlight: require("../../assets/images/animals/bull-highlight.png") },
  cobra: { base: require("../../assets/images/animals/cobra-base.png"), highlight: require("../../assets/images/animals/cobra-highlight.png") },
  dragon: { base: require("../../assets/images/animals/dragon-base.png"), highlight: require("../../assets/images/animals/dragon-highlight.png") },
};

export function crestColors(positions: Positions) {
  return {
    animal: (nearestPoint("values", positions.values).animal ?? "dragon") as AnimalId,
    base: nearestPoint("culture", positions.culture).hex!,
    highlight: nearestPoint("soul", positions.soul).hex!,
    shadow: nearestPoint("focus", positions.focus).hex!,
    primary: nearestPoint("mind", positions.mind).hex!,
  };
}
export function Crest({
  positions,
  size = 44,
  locked = false,
  dot = true,
}: {
  positions: Positions;
  size?: number;
  /** Locked profiles show the silhouette dimmed, per the 50-reaction rule. */
  locked?: boolean;
  /** The Mind-coloured profile dot. */
  dot?: boolean;
}) {
  const { animal, base, highlight, shadow, primary } = crestColors(positions);
  const layers = ANIMAL_LAYERS[animal];
  const dotSize = Math.max(8, Math.round(size * 0.26));
  const radius = size * 0.28;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.plate, { width: size, height: size, borderRadius: radius, backgroundColor: shadow }]}>
        <View style={{ opacity: locked ? 0.18 : 1, width: size, height: size }}>
          <Image source={layers.base} style={[StyleSheet.absoluteFill, { tintColor: base }]} contentFit="contain" />
          <Image source={layers.highlight} style={[StyleSheet.absoluteFill, { tintColor: highlight }]} contentFit="contain" />
        </View>
        <View style={[styles.border, { borderRadius: radius }]} />
      </View>
      {locked && (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: hexToRgba(c.bg, 0.5),
          }}
        />
      )}
      {dot && (
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: primary,
            borderWidth: 2,
            borderColor: c.app,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { overflow: "hidden" },
  border: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
});
