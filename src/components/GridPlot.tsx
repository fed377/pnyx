import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { GRIDS, nearestPoint } from "@/lib/grids";
import type { GridId, Point } from "@/lib/types";
import { c } from "@/theme/tokens";

const PAD = 8;
const SPAN = 100 - PAD * 2;

const sx = (x: number) => PAD + ((x + 1) / 2) * SPAN;
const sy = (y: number) => PAD + ((1 - y) / 2) * SPAN;

export function GridPlot({
  gridId,
  position,
  compare,
  trail,
  size = 132,
  labels = true,
  accent,
}: {
  gridId: GridId;
  position: Point;
  /** A second position to plot, e.g. the person you are comparing against. */
  compare?: Point;
  /** Past positions, oldest first — drawn as the path travelled. */
  trail?: Point[];
  size?: number;
  labels?: boolean;
  accent?: string;
}) {
  const grid = GRIDS[gridId];
  const near = nearestPoint(gridId, position);
  const color = accent ?? near.hex ?? c.text;
  const trailPath =
    trail && trail.length > 1 ? trail.map((p, i) => `${i ? "L" : "M"}${sx(p.x)} ${sy(p.y)}`).join(" ") : null;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x={0} y={0} width={100} height={100} rx={10} fill={c.surface2} />
        <Line x1={PAD} y1={sy(0.5)} x2={100 - PAD} y2={sy(0.5)} stroke={c.line} strokeWidth={0.6} />
        <Line x1={PAD} y1={sy(-0.5)} x2={100 - PAD} y2={sy(-0.5)} stroke={c.line} strokeWidth={0.6} />
        <Line x1={sx(-0.5)} y1={PAD} x2={sx(-0.5)} y2={100 - PAD} stroke={c.line} strokeWidth={0.6} />
        <Line x1={sx(0.5)} y1={PAD} x2={sx(0.5)} y2={100 - PAD} stroke={c.line} strokeWidth={0.6} />
        <Line x1={PAD} y1={sy(0)} x2={100 - PAD} y2={sy(0)} stroke="#33334a" strokeWidth={0.9} />
        <Line x1={sx(0)} y1={PAD} x2={sx(0)} y2={100 - PAD} stroke="#33334a" strokeWidth={0.9} />
        {grid.points.map((p) => (
          <Circle key={`${p.x},${p.y}`} cx={sx(p.x)} cy={sy(p.y)} r={1.5} fill="#3a3a4d" />
        ))}
        {trailPath && (
          <Path d={trailPath} fill="none" stroke={color} strokeOpacity={0.4} strokeWidth={1.2} strokeLinejoin="round" />
        )}
        {compare && (
          <>
            <Line
              x1={sx(position.x)}
              y1={sy(position.y)}
              x2={sx(compare.x)}
              y2={sy(compare.y)}
              stroke={c.textFaint}
              strokeWidth={0.8}
              strokeDasharray="2 2"
            />
            <Circle cx={sx(compare.x)} cy={sy(compare.y)} r={4} fill="none" stroke={c.textDim} strokeWidth={1.4} />
          </>
        )}
        <Circle cx={sx(position.x)} cy={sy(position.y)} r={7} fill={color} fillOpacity={0.16} />
        <Circle cx={sx(position.x)} cy={sy(position.y)} r={3.4} fill={color} />
      </Svg>
      {labels && (
        <>
          <Text style={[styles.label, styles.top]} numberOfLines={1}>
            {grid.axisY.pos}
          </Text>
          <Text style={[styles.label, styles.bottom]} numberOfLines={1}>
            {grid.axisY.neg}
          </Text>
          <Text style={[styles.label, styles.left]} numberOfLines={1}>
            {grid.axisX.neg}
          </Text>
          <Text style={[styles.label, styles.right]} numberOfLines={1}>
            {grid.axisX.pos}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    color: c.textFaint,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  top: { top: 3, alignSelf: "center" },
  bottom: { bottom: 3, alignSelf: "center" },
  left: { left: 3, top: "50%", transform: [{ rotate: "-90deg" }] },
  right: { right: 3, top: "50%", transform: [{ rotate: "90deg" }] },
});
