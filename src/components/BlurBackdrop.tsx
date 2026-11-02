import { BlurTargetView } from "expo-blur";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import type { ViewInstance, ViewProps } from "react-native";
import { useBlurTargetRegistry } from "@/state/blurTarget";
import { OnBackdropProvider } from "@/theme/ink";
import { FlowBackground } from "./FlowBackground";

/**
 * The root of a tab screen. Everything inside it is what the floating tab bar
 * blurs, and it registers itself while the screen is focused so the bar always
 * samples the screen actually on show. The animated FLOW gradient lives here
 * too, behind the content, so the tab bar's blur picks it up — every tab
 * screen gets it for free, not per-screen setup.
 */
export function BlurBackdrop({
  children,
  flow = true,
  ...rest
}: ViewProps & {
  /** Off for a screen whose content covers the whole backdrop anyway (the
   * reel feed) — the shader would otherwise redraw every frame, unseen,
   * and compete with the scroll for the GPU. */
  flow?: boolean;
}) {
  const ref = useRef<ViewInstance>(null);
  const { attach, detach } = useBlurTargetRegistry();

  useFocusEffect(
    useCallback(() => {
      attach(ref.current);
      return () => detach(ref.current);
    }, [attach, detach]),
  );

  return (
    <BlurTargetView ref={ref} {...rest}>
      {flow && <FlowBackground />}
      <OnBackdropProvider value={true}>{children}</OnBackdropProvider>
    </BlurTargetView>
  );
}
