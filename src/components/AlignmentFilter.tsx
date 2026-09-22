import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { track } from "@/analytics/analytics";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Icon } from "./Icon";

/** The alignment slider available across Home and People (spec §6.1). */
export function AlignmentFilter() {
  const { state, dispatch, accent } = useStore();
  const [open, setOpen] = useState(false);
  const value = state.alignmentFilter;

  return (
    <Animated.View style={styles.wrap} layout={Layout.duration(220)}>
      <AnimatedPressable
        onPress={() => setOpen((o) => !o)}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.toggle}
      >
        <Icon name="filter" size={17} color={c.text} />
        <Text style={styles.label}>Alignment filter</Text>
        <Text style={styles.value}>{value === 0 ? "Off" : `${value}%+`}</Text>
      </AnimatedPressable>

      {open && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.body}>
          <Slider
            value={value}
            onValueChange={(v) => dispatch({ type: "filter", value: Math.round(v / 5) * 5 })}
            onSlidingComplete={(v) => track("alignment_filter_used", { value: Math.round(v / 5) * 5 })}
            minimumValue={0}
            maximumValue={90}
            step={5}
            minimumTrackTintColor={accent}
            maximumTrackTintColor={c.surface3}
            thumbTintColor={accent}
            accessibilityLabel="Minimum alignment"
          />
          <Text style={styles.hint}>
            Showing people you align with by at least <Text style={styles.hintNum}>{value}%</Text>. Set it to zero to
            see everyone.
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: r.md, backgroundColor: c.surface, ...squircle },
  toggle: { flexDirection: "row", alignItems: "center", gap: s[2], paddingHorizontal: s[4], paddingVertical: s[3] },
  label: { color: c.textDim, fontSize: f.sm, flex: 1 },
  value: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  body: { paddingHorizontal: s[4], paddingBottom: s[4] },
  hint: { color: c.textFaint, fontSize: f.xs, marginTop: s[2] },
  hintNum: { color: c.text, fontWeight: "600" },
});
