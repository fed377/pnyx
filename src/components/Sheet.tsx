import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { c, display, f, r, s, squircle } from "@/theme/tokens";
import { AnimatedPressable } from "./AnimatedPressable";
import { Icon } from "./Icon";

export function Sheet({
  open,
  title,
  onClose,
  children,
  closeLabel,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** A text button ("Done") instead of the default X close icon. */
  closeLabel?: string;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.layer}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            {closeLabel ? (
              <AnimatedPressable onPress={onClose} hitSlop={8} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={closeLabel}>
                <Text style={styles.closeLabel}>{closeLabel}</Text>
              </AnimatedPressable>
            ) : (
              <AnimatedPressable onPress={onClose} hitSlop={8} scaleTo={0.85} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={20} color={c.text} />
              </AnimatedPressable>
            )}
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.scrim },
  sheet: {
    maxHeight: "78%",
    backgroundColor: c.surface,
    borderTopLeftRadius: r.lg,
    borderTopRightRadius: r.lg,
    ...squircle,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: s[4],
    paddingRight: s[3],
    paddingVertical: s[3],
    borderBottomWidth: 1,
    borderBottomColor: c.lineSoft,
  },
  title: { color: c.text, fontSize: f.md, fontFamily: display.semibold },
  closeLabel: { color: c.textDim, fontSize: f.sm, fontWeight: "600" },
  body: { padding: s[4], paddingBottom: s[6] },
});
