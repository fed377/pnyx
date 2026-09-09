import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { VotePower } from "@/lib/types";
import { c, f, s } from "@/theme/tokens";
import { Icon } from "./Icon";

/** Press-and-hold duration for Love / Hate (spec §4.1). */
export const HOLD_MS = 1500;
/** Point in the hold where the icon flips to the strong reaction. */
const PREVIEW_AT = 0.55;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Dir = 1 | -1;

export function VoteControls({
  current,
  onVote,
  layout = "row",
  size = 42,
  disabled = false,
  onDisabledPress,
  overlay = false,
}: {
  current?: VotePower;
  onVote: (power: VotePower) => void;
  layout?: "row" | "rail";
  size?: number;
  disabled?: boolean;
  onDisabledPress?: () => void;
  /** Sits on top of a reel, so the buttons need their own contrast. */
  overlay?: boolean;
}) {
  const [holding, setHolding] = useState<Dir | null>(null);
  const [preview, setPreview] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(false);

  const clearTimers = useCallback(() => {
    anim.current?.stop();
    anim.current = null;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const burst = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.24, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [scale]);

  const commit = useCallback(
    (power: VotePower) => {
      committed.current = true;
      clearTimers();
      setHolding(null);
      setPreview(false);
      progress.setValue(0);
      onVote(power);
      burst();
    },
    [burst, clearTimers, onVote, progress],
  );

  const begin = useCallback(
    (dir: Dir) => {
      if (disabled) return;
      committed.current = false;
      setHolding(dir);
      setPreview(false);
      progress.setValue(0);
      previewTimer.current = setTimeout(() => setPreview(true), HOLD_MS * PREVIEW_AT);
      anim.current = Animated.timing(progress, {
        toValue: 1,
        duration: HOLD_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      anim.current.start(({ finished }) => {
        if (finished) commit(dir === 1 ? 2 : -2);
      });
    },
    [commit, disabled, progress],
  );

  const release = useCallback(
    (dir: Dir) => {
      if (disabled) return;
      clearTimers();
      setHolding(null);
      setPreview(false);
      progress.setValue(0);
      if (!committed.current) commit(dir === 1 ? 1 : -1);
    },
    [clearTimers, commit, disabled, progress],
  );

  const ringR = size / 2 + 2;
  const circ = 2 * Math.PI * ringR;

  const renderButton = (dir: Dir) => {
    const strong: VotePower = dir === 1 ? 2 : -2;
    const light: VotePower = dir === 1 ? 1 : -1;
    const active = current === strong || current === light;
    const isStrong = current === strong;
    const isHolding = holding === dir;
    const tone = dir === 1 ? c.up : c.down;

    const showStrongIcon = isStrong || (isHolding && preview);
    const iconName = showStrongIcon ? (dir === 1 ? "heart" : "heartBreak") : dir === 1 ? "thumbUp" : "thumbDown";

    const label = isStrong
      ? dir === 1
        ? "Loved"
        : "Hated"
      : active
        ? dir === 1
          ? "Liked"
          : "Disliked"
        : dir === 1
          ? "Like"
          : "Dislike";

    const fg = active || isHolding ? tone : overlay ? "#fff" : c.textDim;
    const bg = active ? (dir === 1 ? c.upSoft : c.downSoft) : overlay ? c.overlay : c.surface;
    const border = active ? tone : overlay ? "rgba(255,255,255,0.16)" : c.line;

    return (
      <View key={dir} style={styles.slot}>
        <Animated.View style={{ transform: [{ scale: isHolding || active ? scale : 1 }] }}>
          <Pressable
            onPressIn={() => (disabled ? onDisabledPress?.() : begin(dir))}
            onPressOut={() => release(dir)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: active }}
            accessibilityLabel={`${dir === 1 ? "Like" : "Dislike"}. Tap to ${
              dir === 1 ? "like" : "dislike"
            }, hold for one and a half seconds to ${dir === 1 ? "love" : "hate"}.`}
            style={[
              styles.btn,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: bg,
                borderColor: border,
                borderWidth: isStrong ? 2 : 1,
              },
              disabled && { opacity: 0.35 },
            ]}
          >
            {isHolding && (
              <View style={[StyleSheet.absoluteFill, styles.ring]}>
                <Svg width={ringR * 2 + 6} height={ringR * 2 + 6} viewBox={`0 0 ${ringR * 2 + 6} ${ringR * 2 + 6}`}>
                  <AnimatedCircle
                    cx={ringR + 3}
                    cy={ringR + 3}
                    r={ringR}
                    fill="none"
                    stroke={tone}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={`${circ}`}
                    strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] })}
                    transform={`rotate(-90 ${ringR + 3} ${ringR + 3})`}
                  />
                </Svg>
              </View>
            )}
            <Icon name={iconName} size={Math.round(size * 0.5)} color={fg} filled={active || isHolding} />
          </Pressable>
        </Animated.View>
        {layout === "rail" && <Text style={styles.caption}>{label}</Text>}
      </View>
    );
  };

  return (
    <View style={layout === "rail" ? styles.rail : styles.row}>
      {renderButton(1)}
      {renderButton(-1)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: s[2] },
  rail: { flexDirection: "column", alignItems: "center", gap: s[4] },
  slot: { alignItems: "center", gap: 4 },
  btn: { alignItems: "center", justifyContent: "center" },
  ring: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  caption: { color: "rgba(236,237,243,0.85)", fontSize: f.xs, fontWeight: "500" },
});
