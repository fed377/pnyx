import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useStore } from "@/state/store";
import { c, f, r, squircle } from "@/theme/tokens";

/** Counts up to `value` once, on mount — the tick-up in spec §6.3. */
export function useTickUp(value: number, ms = 1000, enabled = true) {
  const [shown, setShown] = useState(enabled ? 0 : value);
  const raf = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setShown(value);
      return;
    }
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          setShown(value);
          return;
        }
        const start = Date.now();
        const tick = () => {
          const p = Math.min(1, (Date.now() - start) / ms);
          setShown(value * (1 - (1 - p) ** 3)); // ease-out
          if (p < 1) raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
    };
  }, [value, ms, enabled]);

  return shown;
}

export function AlignmentPill({ value, muted = false }: { value: number; muted?: boolean }) {
  const { accentSoft } = useStore();
  return (
    <View style={[styles.pill, { backgroundColor: muted ? c.surface2 : accentSoft }]}>
      <Text style={styles.pillNum}>{Math.round(value)}</Text>
      <Text style={styles.pillSym}>%</Text>
    </View>
  );
}

export function AlignmentDial({
  value,
  size = 92,
  animate = true,
}: {
  value: number;
  size?: number;
  animate?: boolean;
}) {
  const { accent } = useStore();
  const shown = useTickUp(value, 1100, animate);
  const radius = 46;
  const circ = 2 * Math.PI * radius;

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="image"
      accessibilityLabel={`${Math.round(value)} percent aligned`}
    >
      <Svg width={size} height={size} viewBox="0 0 108 108">
        <Circle cx={54} cy={54} r={radius} fill="none" stroke={c.surface3} strokeWidth={7} />
        <Circle
          cx={54}
          cy={54}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown / 100)}
          transform="rotate(-90 54 54)"
        />
      </Svg>
      <View style={styles.dialValue}>
        <Text style={styles.dialNum}>{Math.round(shown)}</Text>
        <Text style={styles.dialSym}>%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: r.full,
    ...squircle,
  },
  pillNum: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  pillSym: { color: c.textDim, fontSize: 10 },
  dialValue: { position: "absolute", flexDirection: "row", alignItems: "baseline" },
  dialNum: { color: c.text, fontSize: 26, fontWeight: "600" },
  dialSym: { color: c.textDim, fontSize: 12, marginLeft: 1 },
});
