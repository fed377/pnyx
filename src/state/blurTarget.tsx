import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { View } from "react-native";

/**
 * Lets the floating tab bar do a real blur-behind of the screen under it. On
 * Android `BlurView` cannot sample the window on its own — it needs a ref to a
 * `<BlurTargetView>` wrapping the content to blur. That target must be a
 * *sibling* of the bar, never an ancestor: a target containing the BlurView
 * asks the renderer to draw a view tree that contains itself, and Android's
 * hwui recurses until the native stack overflows. So each tab screen registers
 * its own root here as it comes into focus. (On iOS the platform blurs the
 * backdrop itself and the target is ignored.)
 *
 * Mutating a plain ref's `.current` is invisible to React — BlurView's own
 * update check compares `.current` on the very ref object we hand it, so it
 * never sees the transition from "not mounted yet" to "mounted". Routing the
 * attachment through `useState` instead forces a re-render with a genuinely
 * new ref-wrapper object once the target view exists.
 */
const BlurTargetContext = createContext<{
  node: View | null;
  attach: (node: View | null) => void;
  detach: (node: View | null) => void;
} | null>(null);

export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<View | null>(null);

  const attach = useCallback((next: View | null) => setNode(next), []);
  // Screens hand focus over in whichever order the navigator likes; only clear
  // the target if the screen letting go is still the one being blurred.
  const detach = useCallback(
    (leaving: View | null) => setNode((prev) => (prev === leaving ? null : prev)),
    [],
  );

  const value = useMemo(() => ({ node, attach, detach }), [node, attach, detach]);
  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

/** Used by `<BlurBackdrop>`, which every tab screen roots itself in. */
export function useBlurTargetRegistry() {
  const ctx = useContext(BlurTargetContext);
  if (!ctx) throw new Error("useBlurTargetRegistry must be used inside BlurTargetProvider");
  const { attach, detach } = ctx;
  return useMemo(() => ({ attach, detach }), [attach, detach]);
}

/** Read by the tab bar — undefined until a screen has attached its root. */
export function useBlurTarget(): RefObject<View | null> | undefined {
  const ctx = useContext(BlurTargetContext);
  const node = ctx?.node ?? null;
  return useMemo(() => (node ? { current: node } : undefined), [node]);
}
