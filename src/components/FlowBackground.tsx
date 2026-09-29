import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * The app backdrop: a port of the FeralUI "FLOW" gradient in `gradient.jsx`
 * (recipe: stops #FFFFFF / #979797 / #CDD3D9 / #7B7B7B, scale 50, distortion
 * 60, swirl 10, speed 30, grain 15). FeralUI paints FLOW on the CPU per
 * pixel; this is the same maths as a Skia runtime shader: four colour blobs
 * orbit slowly, the plane is warped and swirled around the centre, and the
 * blobs are blended by inverse distance in OKLab. Film grain is an overlay
 * blend of per-point noise, as in the export.
 */

const STOPS = ["#FFFFFF", "#B8B8B8", "#DDDDD6", "#A6A6A6"] as const;

/** FeralUI's clock: `speed / 100 * 1.2` units per second, from the recipe's saved `startT`. */
const START_T = 36.8185668799998;
const RATE = (30 / 100) * 1.2;

/** Each run is one long linear timing that restarts itself when it finishes. */
const RUN_SECONDS = 600;

/** Where the clock stopped last, handed from one tab's backdrop to the next so
 * switching tabs carries on the same motion instead of jumping. */
let savedTime = START_T;

const SOURCE = `
uniform float2 u_res;
uniform float u_time;
uniform float3 u_c0;
uniform float3 u_c1;
uniform float3 u_c2;
uniform float3 u_c3;

// scale 50 -> 0.4 + 0.5 * 1.2; distortion 60; swirl 10; IDW power 3.5 (FeralUI's cl)
const float ZOOM = 1.0;
const float DISTORTION = 0.6;
const float SWIRL = 0.1;
const float HALF_POWER = 1.75;
const float GRAIN = 0.075; // grain 15 -> 15 / 100 * 0.5

float smooth01(float x) { float t = clamp(x, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }

// Blob k's position at time t (FeralUI's fn).
float2 orbit(float k, float t) {
  float n = k * 0.37;
  float a = 0.6 + fract(k / 3.0) * 0.9;
  float o = 0.8 + fract((k + 1.0) / 4.0);
  return float2(0.5 + 0.5 * sin(t * a + n), 0.5 + 0.5 * cos(t * o + n * 1.5));
}

float weight(float2 p, float2 c) {
  float2 d = p - c;
  return 1.0 / (pow(dot(d, d), HALF_POWER) + 1e-4);
}

float3 oklabToSrgb(float3 lab) {
  float l = pow(lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z, 3.0);
  float m = pow(lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z, 3.0);
  float s = pow(lab.x - 0.0894841775 * lab.y - 1.291485548 * lab.z, 3.0);
  float3 lin = float3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  lin = max(lin, float3(0.0));
  float3 lo = lin * 12.92;
  float3 hi = 1.055 * pow(lin, float3(1.0 / 2.4)) - 0.055;
  return clamp(mix(hi, lo, step(lin, float3(0.0031308))), 0.0, 1.0);
}

half4 main(float2 pos) {
  float t = u_time;
  float2 uv = pos / u_res;
  float x = (uv.x - 0.5) / ZOOM + 0.5;
  float y = (uv.y - 0.5) / ZOOM + 0.5;

  float edge = smooth01(length(float2(x - 0.5, y - 0.5)));
  float inner = 1.0 - edge;
  for (int i = 1; i <= 2; i++) {
    float k = float(i);
    x += DISTORTION * inner / k * sin(t + k * 0.4 * smooth01(y)) * cos(0.2 * t + k * 2.4 * smooth01(y));
    y += DISTORTION * inner / k * cos(t + k * 2.0 * smooth01(x));
  }

  float swirl = -3.0 * SWIRL * edge;
  float cs = cos(swirl);
  float sn = sin(swirl);
  float2 p = float2(cs * (x - 0.5) - sn * (y - 0.5) + 0.5, sn * (x - 0.5) + cs * (y - 0.5) + 0.5);

  float w0 = weight(p, orbit(0.0, t));
  float w1 = weight(p, orbit(1.0, t));
  float w2 = weight(p, orbit(2.0, t));
  float w3 = weight(p, orbit(3.0, t));
  float3 lab = (u_c0 * w0 + u_c1 * w1 + u_c2 * w2 + u_c3 * w3) / max(1e-4, w0 + w1 + w2 + w3);
  float3 base = oklabToSrgb(lab);

  // Static grain: one noise cell per point, overlay-blended.
  float g = fract(sin(dot(floor(pos), float2(12.9898, 78.233))) * 43758.5453);
  float3 overlay = mix(2.0 * base * g, 1.0 - 2.0 * (1.0 - base) * (1.0 - g), step(0.5, base));
  return half4(mix(base, overlay, GRAIN), 1.0);
}
`;

const effect = Skia.RuntimeEffect.Make(SOURCE);

/** sRGB hex → OKLab, exactly as FeralUI's `tt`. */
function hexToOklab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const COLORS = STOPS.map(hexToOklab);

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => live && setReduce(on));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setActive(s === "active"));
    return () => sub.remove();
  }, []);
  return active;
}

export function FlowBackground() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const time = useSharedValue(savedTime);

  // Only the screen on show drives the clock (tabs stay mounted). It holds
  // still in the background — so it resumes where it was rather than jumping
  // ahead by however long the app was away — and entirely for people who've
  // asked for reduced motion.
  const focused = useIsFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  const running = focused && appActive && !reduceMotion;
  useEffect(() => {
    if (!running) return;
    const run = () => {
      time.value = withTiming(
        time.value + RATE * RUN_SECONDS,
        { duration: RUN_SECONDS * 1000, easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(run)();
        },
      );
    };
    time.value = savedTime;
    run();
    return () => {
      cancelAnimation(time);
      savedTime = time.value;
    };
  }, [running, time]);

  const uniforms = useDerivedValue(() => ({
    u_res: [Math.max(1, size.width), Math.max(1, size.height)],
    u_time: time.value,
    u_c0: COLORS[0],
    u_c1: COLORS[1],
    u_c2: COLORS[2],
    u_c3: COLORS[3],
  }));

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.fallback]}
      pointerEvents="none"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {effect && size.width > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={effect} uniforms={uniforms} />
          </Fill>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Shown for the instant before the first frame paints (and if the shader
  // ever fails to compile): a grey from the middle of the gradient's range.
  fallback: { backgroundColor: "#C4C7CB" },
});
