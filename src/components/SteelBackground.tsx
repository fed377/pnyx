import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { c } from "@/theme/tokens";

/**
 * "Soft card: near-white paper... floating on the steel ground" (Figma component
 * sheet). The ground isn't a flat fill — it's a few soft, irregular light/dark
 * patches, like brushed steel catching light unevenly. Sampled from the handoff
 * renders rather than guessed: light near the top, a darker patch around the
 * vertical middle, lighter again below that, and a touch darker at the very
 * bottom edge.
 */
export function SteelBackground() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 220"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="patchLight1" cx="22%" cy="6%" r="65%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="patchDark1" cx="48%" cy="47%" r="50%">
          <Stop offset="0" stopColor="#a9abb2" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#a9abb2" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="patchLight2" cx="66%" cy="76%" r="42%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.8} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="patchDark2" cx="28%" cy="99%" r="38%">
          <Stop offset="0" stopColor="#a9abb2" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#a9abb2" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={220} fill={c.app} />
      <Rect x={0} y={0} width={100} height={220} fill="url(#patchDark1)" />
      <Rect x={0} y={0} width={100} height={220} fill="url(#patchDark2)" />
      <Rect x={0} y={0} width={100} height={220} fill="url(#patchLight1)" />
      <Rect x={0} y={0} width={100} height={220} fill="url(#patchLight2)" />
    </Svg>
  );
}
