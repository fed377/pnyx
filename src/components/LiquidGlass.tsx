import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useBlurTarget } from "@/state/blurTarget";
import { r } from "@/theme/tokens";

/**
 * Real UIGlassEffect only exists on iOS 26+, and even there the native module
 * can be absent — an older Expo Go binary that predates this API, or one of
 * the iOS 26 betas expo-glass-effect's own docs warn crash on `isLiquidGlassAvailable`
 * (github.com/expo/expo/issues/40911). Every check here is try/caught so a
 * missing native module degrades to the existing frosted-blur look instead of
 * throwing at startup.
 *
 * Known tradeoff: real UIGlassEffect adaptively re-tints itself toward dark
 * based on whatever content sits behind it — that's the material's defining
 * behavior, and the `colorScheme` prop below biases it but doesn't fully
 * suppress it, so it can visibly darken over the app's darker background
 * patches or media in Feed. That's accepted here in exchange for the real
 * glass look rather than disabling the effect outright.
 */
let cached: boolean | null = null;

export function liquidGlassSupported(): boolean {
  if (cached !== null) return cached;
  if (Platform.OS !== "ios") {
    cached = false;
    return false;
  }
  try {
    cached = isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    cached = false;
  }
  return cached;
}

export function LiquidGlassSurface({
  style,
  radius = r.full,
  interactive = false,
  tint,
  fill = true,
  glassStyle = "regular",
  tintColor,
  forceBlur = false,
}: {
  style?: StyleProp<ViewStyle>;
  radius?: number;
  interactive?: boolean;
  tint?: "light" | "dark";
  /** False when a caller already positions/sizes this view itself (e.g. an
   * Animated.View driving a sliding pill) and the built-in absolute-fill
   * would fight that sizing. */
  fill?: boolean;
  glassStyle?: "regular" | "clear";
  /** Darkens/colors the glass itself, e.g. to read as a distinct layer above
   * a lighter glass surface underneath it. */
  tintColor?: string;
  /**
   * Skips real UIGlassEffect even where it's supported, in favor of the
   * deterministic BlurView path. Real glass's adaptive re-tint (see this
   * file's own top comment) doesn't just darken — over Feed's varied reel
   * content it can also swing toward white despite `tint="dark"`, washing
   * out against the always-white icons drawn on top of it and leaving
   * nothing readable. Reach for this on chrome that sits over unpredictable
   * media and needs its tint to hold no matter what's behind it, not as a
   * blanket default.
   */
  forceBlur?: boolean;
}) {
  const blurTarget = useBlurTarget();
  const base = fill ? StyleSheet.absoluteFill : undefined;

  if (liquidGlassSupported() && !forceBlur) {
    return (
      <GlassView
        style={[base, { borderRadius: radius }, style]}
        glassEffectStyle={glassStyle}
        isInteractive={interactive}
        colorScheme={tint ?? "light"}
        tintColor={tintColor}
      />
    );
  }

  return (
    <BlurView
      tint={tint ?? "light"}
      intensity={92}
      blurTarget={blurTarget}
      blurMethod={Platform.OS === "android" && blurTarget ? "dimezisBlurViewSdk31Plus" : undefined}
      style={[base, { borderRadius: radius, overflow: "hidden" }, style]}
    >
      {tintColor && <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />}
    </BlurView>
  );
}
