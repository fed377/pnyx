import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";
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
      {icon && <Icon name={icon} size={14} color={c.textFaint} />}
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function LockedRow({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.lockedRow}>
      <Icon name="lock" size={16} color={c.textFaint} />
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
  variant?: "default" | "accent" | "danger";
  icon?: IconName;
  disabled?: boolean;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { accent } = useStore();
  const bg = variant === "accent" ? accent : variant === "danger" ? c.down : c.surface2;
  const fg = variant === "accent" || variant === "danger" ? c.onAccent : c.text;

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
        wide && { alignSelf: "stretch" },
        disabled && { opacity: 0.42 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={16} color={fg} />}
      <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export function IconBtn({
  name,
  onPress,
  label,
  size = 20,
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
      <Icon name={name} size={size} color={color ?? c.textDim} />
      {badge !== undefined && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{badge}</Text>
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
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
    ...squircle,
  },
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
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
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
});
