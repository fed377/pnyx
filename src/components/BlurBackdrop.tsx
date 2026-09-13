import { BlurTargetView } from "expo-blur";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import type { View, ViewProps } from "react-native";
import { useBlurTargetRegistry } from "@/state/blurTarget";

/**
 * The root of a tab screen. Everything inside it is what the floating tab bar
 * blurs, and it registers itself while the screen is focused so the bar always
 * samples the screen actually on show.
 */
export function BlurBackdrop({ children, ...rest }: ViewProps) {
  const ref = useRef<View>(null);
  const { attach, detach } = useBlurTargetRegistry();

  useFocusEffect(
    useCallback(() => {
      attach(ref.current);
      return () => detach(ref.current);
    }, [attach, detach]),
  );

  return (
    <BlurTargetView ref={ref} {...rest}>
      {children}
    </BlurTargetView>
  );
}
