import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { enter, exit } from "@/theme/motion";
import { c, f, r, s, squircle } from "@/theme/tokens";

const ToastContext = createContext<(msg: string) => void>(() => {});

const SHOW_MS = 2400;

export function ToastProvider({ children }: { children: ReactNode }) {
  // Each toast has its own id, so a new one (even with the same text) replaces
  // the last with a crossfade and a fresh timer instead of a text swap.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const show = useCallback((text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      <View style={styles.host}>{children}</View>
      {toast && (
        <Animated.View
          key={toast.id}
          entering={enter.rise()}
          exiting={exit.fade()}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={styles.toast}
        >
          <Text style={styles.text}>{toast.text}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  host: { flex: 1 },
  toast: {
    position: "absolute",
    left: s[4],
    right: s[4],
    bottom: 96,
    alignSelf: "center",
    alignItems: "center",
    paddingVertical: s[2],
    paddingHorizontal: s[4],
    borderRadius: r.full,
    backgroundColor: c.surface3,
    ...squircle,
  },
  text: { color: c.text, fontSize: f.sm },
});
