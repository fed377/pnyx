import type { JSX } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
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
 */

type Parts = { base: string; hl: string };

const eye = (cx: number, cy: number, r: number, fill: string) => (
  <Circle cx={cx} cy={cy} r={r} fill={fill} />
);

const ANIMALS: Record<AnimalId, (p: Parts) => JSX.Element> = {
  wolf: ({ base, hl }) => (
    <>
      <Path d="M14 9 L23 22 L41 22 L50 9 L53 29 L45 43 L32 56 L19 43 L11 29 Z" fill={base} />
      <Path d="M27 40 L37 40 L32 56 Z" fill={hl} />
      {eye(24, 28, 2.6, hl)}
      {eye(40, 28, 2.6, hl)}
    </>
  ),
  fox: ({ base, hl }) => (
    <>
      <Path d="M9 5 L22 23 L42 23 L55 5 L57 28 L46 41 L32 58 L18 41 L7 28 Z" fill={base} />
      <Path d="M28 39 L36 39 L32 58 Z" fill={hl} />
      {eye(24, 29, 2.4, hl)}
      {eye(40, 29, 2.4, hl)}
    </>
  ),
  bear: ({ base, hl }) => (
    <>
      <Circle cx={16} cy={16} r={8} fill={base} />
      <Circle cx={48} cy={16} r={8} fill={base} />
      <Path d="M12 25 Q32 14 52 25 L54 38 Q32 58 10 38 Z" fill={base} />
      <Ellipse cx={32} cy={43} rx={9} ry={7} fill={hl} />
      {eye(23, 31, 2.4, hl)}
      {eye(41, 31, 2.4, hl)}
    </>
  ),
  lion: ({ base, hl }) => {
    const mane = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const b = a + Math.PI / 14;
      const c = a - Math.PI / 14;
      const pt = (ang: number, r: number) => `${32 + Math.cos(ang) * r} ${32 + Math.sin(ang) * r}`;
      return <Path key={i} d={`M${pt(c, 15)} L${pt(a, 27)} L${pt(b, 15)} Z`} fill={base} />;
    });
    return (
      <>
        {mane}
        <Circle cx={32} cy={32} r={16} fill={base} />
        <Ellipse cx={32} cy={38} rx={7} ry={5} fill={hl} />
        {eye(26, 29, 2.4, hl)}
        {eye(38, 29, 2.4, hl)}
      </>
    );
  },
  eagle: ({ base, hl }) => (
    <>
      <Path d="M13 22 Q17 8 33 8 Q45 8 48 18 L60 26 L48 32 Q46 46 32 50 Q14 48 13 22 Z" fill={base} />
      <Path d="M48 18 L61 26 L48 32 Z" fill={hl} />
      {eye(36, 22, 3, hl)}
    </>
  ),
  deer: ({ base, hl }) => (
    <>
      <Path d="M22 24 L10 20 L21 31 Z" fill={base} />
      <Path d="M42 24 L54 20 L43 31 Z" fill={base} />
      <Path d="M22 22 L42 22 L44 38 L32 56 L20 38 Z" fill={base} />
      <Path
        d="M25 23 L20 11 M20 11 L11 6 M20 11 L17 2 M39 23 L44 11 M44 11 L53 6 M44 11 L47 2"
        stroke={hl}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      {eye(26, 32, 2.2, hl)}
      {eye(38, 32, 2.2, hl)}
    </>
  ),
  owl: ({ base, hl }) => (
    <>
      <Path d="M9 17 L19 7 L26 17 L38 17 L45 7 L55 17 L55 34 Q32 58 9 34 Z" fill={base} />
      <Circle cx={23} cy={29} r={8} fill={hl} />
      <Circle cx={41} cy={29} r={8} fill={hl} />
      {eye(23, 29, 3.4, base)}
      {eye(41, 29, 3.4, base)}
      <Path d="M32 34 L28 40 L32 45 L36 40 Z" fill={hl} />
    </>
  ),
  turtle: ({ base, hl }) => (
    <>
      <Circle cx={32} cy={12} r={7} fill={base} />
      <Path d="M32 18 L52 29 L52 45 L32 56 L12 45 L12 29 Z" fill={base} />
      <Path d="M32 26 L45 33 L45 44 L32 51 L19 44 L19 33 Z" fill={hl} />
      <Path d="M32 33 L39 37 L39 44 L32 48 L25 44 L25 37 Z" fill={base} />
      {eye(28, 11, 1.8, hl)}
      {eye(36, 11, 1.8, hl)}
    </>
  ),
  fish: ({ base, hl }) => (
    <>
      <Path d="M18 32 Q34 12 54 32 Q34 52 18 32 Z" fill={base} />
      <Path d="M18 32 L5 19 L9 32 L5 45 Z" fill={base} />
      <Path d="M27 25 L33 32 L27 39" stroke={hl} strokeWidth={3} fill="none" strokeLinecap="round" />
      {eye(44, 29, 3, hl)}
    </>
  ),
  capybara: ({ base, hl }) => (
    <>
      <Circle cx={16} cy={14} r={5} fill={base} />
      <Circle cx={48} cy={14} r={5} fill={base} />
      <Path d="M14 25 Q14 15 25 15 L39 15 Q50 15 50 25 L50 40 Q50 54 32 55 Q14 54 14 40 Z" fill={base} />
      <Path d="M23 42 Q32 38 41 42 Q41 51 32 51 Q23 51 23 42 Z" fill={hl} />
      {eye(24, 29, 2.4, hl)}
      {eye(40, 29, 2.4, hl)}
    </>
  ),
  bull: ({ base, hl }) => (
    <>
      <Path d="M21 25 Q6 24 7 9 Q17 11 23 22 Z" fill={hl} />
      <Path d="M43 25 Q58 24 57 9 Q47 11 41 22 Z" fill={hl} />
      <Path d="M20 20 L44 20 L47 37 L32 55 L17 37 Z" fill={base} />
      <Ellipse cx={32} cy={43} rx={7} ry={5} fill={hl} />
      {eye(26, 29, 2.4, hl)}
      {eye(38, 29, 2.4, hl)}
    </>
  ),
  cobra: ({ base, hl }) => (
    <>
      <Path d="M32 57 L11 31 Q6 9 32 5 Q58 9 53 31 Z" fill={base} />
      <Path d="M32 13 L22 26 L32 22 L42 26 Z" fill={hl} />
      {eye(25, 31, 2.6, hl)}
      {eye(39, 31, 2.6, hl)}
    </>
  ),
  dragon: ({ base, hl }) => (
    <>
      <Path d="M27 17 L17 4 L25 11 L33 3 L35 15 Z" fill={hl} />
      <Path d="M15 25 L28 16 L47 19 L59 29 L46 36 L44 45 L27 50 L15 41 Z" fill={base} />
      <Path d="M46 36 L44 45 L34 47 Z" fill={hl} />
      {eye(42, 28, 3, hl)}
    </>
  ),
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
  const Animal = ANIMALS[animal];
  const dotSize = Math.max(8, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x={0} y={0} width={64} height={64} rx={18} fill={shadow} />
        <G opacity={locked ? 0.18 : 1}>
          <Animal base={base} hl={highlight} />
        </G>
        <Rect
          x={0.5}
          y={0.5}
          width={63}
          height={63}
          rx={17.5}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
        />
      </Svg>
      {locked && (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            borderRadius: size * 0.28,
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
