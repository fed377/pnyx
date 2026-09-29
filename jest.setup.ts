import { configure } from "@testing-library/react-native";

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Native media modules have no implementation under jest; the screens only need
// them to render something.
jest.mock("expo-video", () => {
  const React = require("react");
  return {
    useVideoPlayer: () => ({ play: () => {}, pause: () => {}, loop: false, muted: true }),
    VideoView: (props: Record<string, unknown>) => React.createElement("VideoView", props),
  };
});

// Skia's own jest mock needs a CanvasKit (WASM) test environment; the backdrop
// only has to mount, not draw.
jest.mock("@shopify/react-native-skia", () => {
  const React = require("react");
  const passthrough = (name: string) => {
    const Mock = (props: { children?: unknown }) => React.createElement(name, null, props.children);
    Mock.displayName = name;
    return Mock;
  };
  return {
    Canvas: passthrough("Canvas"),
    Fill: passthrough("Fill"),
    Shader: passthrough("Shader"),
    Skia: { RuntimeEffect: { Make: () => ({}) } },
  };
});

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchImageLibraryAsync: async () => ({ canceled: true }),
}));

// The first mount compiles the whole route graph, which can take several seconds.
configure({ asyncUtilTimeout: 15_000 });
jest.setTimeout(60_000);

// The mock store is module-level, so votes would otherwise leak between tests.
beforeEach(async () => {
  const mod = require("@react-native-async-storage/async-storage");
  const AsyncStorage = mod.default ?? mod;
  await AsyncStorage.clear();
});
