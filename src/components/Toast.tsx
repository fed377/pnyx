import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { c, f, r, s, squircle } from "@/theme/tokens";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  const show = useCallback((m: string) => setMsg(m), []);

  useEffect(() => {
    if (!msg) return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setMsg(null));
    }, 2200);
    return () => clearTimeout(t);
  }, [msg, fade]);

  return (
    <ToastContext.Provider value={show}>
      <View style={styles.host}>{children}</View>
      {msg && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
          ]}
        >
          <Text style={styles.text}>{msg}</Text>
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
