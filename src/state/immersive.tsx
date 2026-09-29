import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * "Show only the media": set while a reel is being pinch-zoomed, so the tab
 * layout can drop its floating chrome (tab bar, search circle). Those are
 * native glass surfaces, which fail to composite under an animated opacity
 * (see PeopleHomeButton in the tabs layout), so they hide outright rather
 * than fade.
 */
const ImmersiveContext = createContext<{ immersive: boolean; setImmersive: (on: boolean) => void }>({
  immersive: false,
  setImmersive: () => {},
});

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(false);
  const value = useMemo(() => ({ immersive, setImmersive }), [immersive]);
  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>;
}

export const useImmersive = () => useContext(ImmersiveContext);
