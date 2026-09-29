import { Gesture } from "react-native-gesture-handler";
import { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const MAX_ZOOM = 4;
const RESET_MS = 220;

/**
 * Pinch-to-zoom anchored on the pinch's focal point, following the fingers
 * as they move, and easing back to fit on release — the reel apps'
 * convention, so a zoom never leaves the media stuck half-cropped. A timed
 * ease-out rather than a spring: springing back from up to 4× overshoots and
 * reads as the media bouncing.
 *
 * `width`/`height` are the zoomed view's own size (focal points arrive in its
 * coordinates). `chromeStyle` fades out whatever overlays the media as soon as
 * a pinch starts growing it, and back in as it settles, so a zoom shows only
 * the media itself.
 */
export function useZoom(width: number, height: number, onZoomingChange?: (zooming: boolean) => void) {
  const scale = useSharedValue(1);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);

  const notify = (zooming: boolean) => onZoomingChange?.(zooming);

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      originX.value = e.focalX - width / 2;
      originY.value = e.focalY - height / 2;
      runOnJS(notify)(true);
    })
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, e.scale));
      panX.value = e.focalX - width / 2 - originX.value;
      panY.value = e.focalY - height / 2 - originY.value;
    })
    // onFinalize, not onEnd: it runs however the gesture finishes (including
    // cancellation), so the media always resets and the chrome always returns.
    .onFinalize(() => {
      const settle = { duration: RESET_MS, easing: Easing.out(Easing.cubic) };
      scale.value = withTiming(1, settle);
      panX.value = withTiming(0, settle);
      panY.value = withTiming(0, settle);
      runOnJS(notify)(false);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value + originX.value },
      { translateY: panY.value + originY.value },
      { scale: scale.value },
      { translateX: -originX.value },
      { translateY: -originY.value },
    ],
  }));

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.value, [1, 1.06], [1, 0], "clamp"),
  }));

  return { pinch, style, chromeStyle };
}
