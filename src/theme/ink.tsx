import { createContext, useContext } from "react";
import { c } from "./tokens";

/**
 * Whether the nearest surface behind this component is the animated FLOW
 * backdrop (a tab screen's BlurBackdrop) rather than a painted surface. The
 * backdrop swings as dark as ~#9f9f9f, where textDim/textFaint fall to
 * ~2:1 and ~1:1, so secondary text sitting straight on it needs darker ink.
 * BlurBackdrop sets this; Card and LockedRow reset it for their contents.
 */
const OnBackdrop = createContext(false);

export const OnBackdropProvider = OnBackdrop.Provider;

/** Secondary text colours that stay readable on whatever surface this renders on. */
export function useInk(): { dim: string; faint: string } {
  return useContext(OnBackdrop)
    ? { dim: c.backdropDim, faint: c.backdropFaint }
    : { dim: c.textDim, faint: c.textFaint };
}
