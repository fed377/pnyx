import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle, STEEL_GRADIENT } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

/* ── Text ─────────────────────────────────────────────────────────────────── */

export function SectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Note({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <View style={styles.note}>
      {icon && <Icon name={icon} size={14} color={c.text} />}
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

/**
 * "Soft card" (near-white paper, hairline edge) is the default. `tone="ink"`
 * is the inverted print card — solid black, light text — for a display-type
 * callout, never a whole screen's worth of surfaces.
 */
export function Card({
  children,
  style,
  tone = "soft",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: "soft" | "ink";
}) {
  return <View style={[styles.card, tone === "ink" && styles.cardInk, style]}>{children}</View>;
}

export function LockedRow({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.lockedRow}>
      <Icon name="lock" size={16} color={c.text} />
      <View style={{ flex: 1 }}>{children}</View>
      {action}
    </View>
  );
}

/* ── Button ───────────────────────────────────────────────────────────────── */

export function Btn({
  label,
  onPress,
  variant = "default",
  icon,
  disabled = false,
  wide = false,
  style,
}: {
  label: string;
  onPress: () => void;
  /** `outline` is the bordered secondary button; `live` is the one gradient
   * exception to the monochrome brief, for an in-progress/uploading action;
   * `ink` is a plain solid-black action button — unlike `accent`, it never
   * shifts to the user's grid color, for chrome that isn't "meaningful data". */
  variant?: "default" | "accent" | "danger" | "outline" | "live" | "ink";
  icon?: IconName;
  disabled?: boolean;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { accent } = useStore();
  const bg =
    variant === "accent"
      ? accent
      : variant === "danger"
        ? c.down
        : variant === "ink"
          ? c.text
          : variant === "outline"
            ? "transparent"
            : c.surface2;
  const fg = variant === "accent" || variant === "danger" || variant === "live" || variant === "ink" ? c.onAccent : c.text;

  const content = (
    <>
      {icon && <Icon name={icon} size={16} color={fg} />}
      <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
    </>
  );

  if (variant === "live") {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: true }}
        scaleTo={0.96}
        style={[wide && { alignSelf: "stretch" }, disabled && { opacity: 0.42 }, style]}
      >
        <LinearGradient
          colors={STEEL_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, styles.btnLive]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      scaleTo={0.96}
      style={[
        styles.btn,
        { backgroundColor: bg },
        variant === "outline" && styles.btnOutline,
        wide && { alignSelf: "stretch" },
        disabled && { opacity: 0.42 },
        style,
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}

export function IconBtn({
  name,
  onPress,
  label,
  size = 22,
  color,
  badge,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  badge?: number;
}) {
  const { accent } = useStore();
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      scaleTo={0.88}
      style={styles.iconBtn}
    >
      <Icon name={name} size={size} color={color ?? c.text} />
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────────── */

/** Three states — default (outline), selected (solid ink), disabled (flat grey) — no fourth. */
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  // Selecting a chip used to snap straight to solid black — the fill now eases
  // in, the same way flipping a real switch reads as a change instead of a cut.
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 160 });
  }, [selected, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ["rgba(0,0,0,0)", c.text]),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [c.text, c.app]),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || !onPress}
      scaleTo={0.95}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected, disabled }}
      style={[styles.chip, !disabled && fillStyle, disabled && !selected && styles.chipDisabled]}
    >
      <Animated.Text style={[styles.chipText, !disabled && textStyle, disabled && !selected && styles.chipText]}>
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

/* ── Icon tile ────────────────────────────────────────────────────────────── */

/** A small squircle badge for a single glyph — a status dot, a compact action, an app-icon-shaped preview. */
export function IconTile({
  icon,
  size = 40,
  tone = "soft",
}: {
  icon: IconName;
  size?: number;
  tone?: "soft" | "ink";
}) {
  return (
    <View
      style={[
        styles.iconTile,
        tone === "ink" && styles.iconTileInk,
        { width: size, height: size, borderRadius: size * 0.28 },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.42)} color={tone === "ink" ? c.app : c.text} />
    </View>
  );
}

/* ── Progress ─────────────────────────────────────────────────────────────── */

/** A determinate meter — pulled out of the unlock banner so every progress bar in the app is the same component. */
export function Progress({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, value)) * 100, { duration: 420 });
  }, [value, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      style={[styles.progressTrack, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

/* ── Switch ───────────────────────────────────────────────────────────────── */

/** Off is a flat grey track; on is the same steel gradient the "live" button uses. */
const TOGGLE_TRACK_W = 48;
const TOGGLE_THUMB_W = 22;
const TOGGLE_TRAVEL = TOGGLE_TRACK_W - TOGGLE_THUMB_W - 4;

export function Toggle({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
}) {
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, x]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * TOGGLE_TRAVEL }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      scaleTo={0.97}
    >
      {value ? (
        <LinearGradient
          colors={STEEL_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.toggleTrack}
        >
          <Animated.View style={[styles.toggleThumb, thumbStyle]} />
        </LinearGradient>
      ) : (
        <View style={[styles.toggleTrack, styles.toggleTrackOff]}>
          <Animated.View style={[styles.toggleThumb, thumbStyle]} />
        </View>
      )}
    </AnimatedPressable>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

export function SegTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { accent } = useStore();
  return (
    <View style={styles.tabs}>
      {tabs.map(([key, label]) => {
        const active = key === value;
        return (
          <AnimatedPressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            scaleTo={0.96}
            style={[styles.tab, active && { borderBottomColor: accent }]}
          >
            <Text style={[styles.tabLabel, active && { color: c.text }]}>{label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

/* ── Field ────────────────────────────────────────────────────────────────── */

export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  maxLength,
  placeholder,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        accessibilityLabel={label}
        secureTextEntry={secureTextEntry}
        autoCapitalize={secureTextEntry ? "none" : undefined}
        autoCorrect={secureTextEntry ? false : undefined}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: "top", paddingTop: 10 }]}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  sectionTitle: {
    color: c.textFaint,
    fontSize: f.xs,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: s[3],
  },
  note: { flexDirection: "row", alignItems: "center", gap: s[2] },
  noteText: { color: c.textDim, fontSize: f.sm, flex: 1 },
  empty: {
    paddingVertical: s[5],
    paddingHorizontal: s[4],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: r.md,
  },
  emptyText: { color: c.textDim, fontSize: f.sm, textAlign: "center" },
  card: {
    padding: s[4],
    borderRadius: r.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.lineSoft,
    ...squircle,
  },
  cardInk: { backgroundColor: c.text, borderColor: c.text },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s[3],
    padding: s[4],
    borderRadius: r.md,
    backgroundColor: c.surface,
    ...squircle,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: s[2],
    minHeight: 40,
    paddingHorizontal: s[4],
    borderRadius: r.full,
    ...squircle,
  },
  btnLabel: { fontSize: f.sm, fontWeight: "500" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 4,
    borderRadius: r.full,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: c.onAccent, fontSize: 9, fontWeight: "700" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.line },
  tab: {
    paddingVertical: s[2],
    paddingHorizontal: s[3],
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabLabel: { color: c.textFaint, fontSize: f.sm },
  field: { gap: 5, marginBottom: s[3] },
  fieldLabel: {
    color: c.textFaint,
    fontSize: f.xs,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  input: {
    color: c.text,
    fontSize: f.sm,
    paddingHorizontal: s[3],
    paddingVertical: 10,
    borderRadius: r.sm,
    backgroundColor: c.surface2,
    ...squircle,
  },
  btnOutline: { borderWidth: 1, borderColor: c.text },
  btnLive: { minHeight: 40, paddingHorizontal: s[4] },
  chip: {
    paddingHorizontal: s[3],
    paddingVertical: 7,
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: c.text,
    ...squircle,
  },
  chipSelected: { backgroundColor: c.text, borderColor: c.text },
  chipDisabled: { backgroundColor: c.surface3, borderColor: c.surface3 },
  chipText: { color: c.text, fontSize: f.xs, fontWeight: "600" },
  chipTextSelected: { color: c.app },
  iconTile: { alignItems: "center", justifyContent: "center", backgroundColor: c.surface2, ...squircle },
  iconTileInk: { backgroundColor: c.text },
  progressTrack: { height: 4, borderRadius: r.full, backgroundColor: c.surface3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: r.full, backgroundColor: c.text },
  toggleTrack: {
    width: TOGGLE_TRACK_W,
    height: 28,
    borderRadius: r.full,
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackOff: { backgroundColor: c.surface3 },
  toggleThumb: {
    width: TOGGLE_THUMB_W,
    height: TOGGLE_THUMB_W,
    borderRadius: TOGGLE_THUMB_W / 2,
    backgroundColor: "#ffffff",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
