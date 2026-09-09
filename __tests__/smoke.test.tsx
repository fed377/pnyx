import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

const APP = "./src/app";

/** Every surface should mount and show its own content, not just a shell. */
const ROUTES: [url: string, expected: RegExp][] = [
  ["/", /more reactions/i],
  ["/feed", /Calibrating/i],
  ["/people", /Most aligned/i],
  ["/profile", /The five grids/i],
  ["/u/mara", /Mara Colombo/],
  ["/u/konsta", /Kept private/i],
  ["/settings", /Forget me/i],
  ["/stats", /reactions recorded/i],
  ["/messages", /Mara Colombo/],
  ["/messages/m1", /Exactly the complaint/i],
  ["/contribute", /Only Speakers can post/i],
  ["/notifications", /loved your take on shared rooms/i],
];

describe("startup", () => {
  it("renders even if storage never responds", async () => {
    // Regression: gating the tree on hydration left the app stuck on the splash
    // screen, because expo-router only hides it once the navigator mounts.
    const original = AsyncStorage.getItem;
    AsyncStorage.getItem = () => new Promise<string | null>(() => {});

    try {
      await renderRouter(APP, { initialUrl: "/" });
      expect((await screen.findAllByText(/more reactions/i)).length).toBeGreaterThan(0);
    } finally {
      AsyncStorage.getItem = original;
    }
  });
});

describe("every route renders", () => {
  it.each(ROUTES)("%s", async (url, expected) => {
    // RNTL 14 renders asynchronously, so renderRouter must be awaited.
    await renderRouter(APP, { initialUrl: url });
    // Several screens legitimately repeat a phrase (five "Kept private" cards, say).
    expect((await screen.findAllByText(expected)).length).toBeGreaterThan(0);
  });
});

describe("voting", () => {
  it("a tap records a like, reveals the split, and advances the unlock", async () => {
    await renderRouter(APP, { initialUrl: "/" });

    const banner = (await screen.findAllByText(/more reactions/i))[0];
    const before = Number(String(banner.props.children).match(/\d+/)![0]);
    expect(before).toBeGreaterThan(0);

    const like = screen.getAllByLabelText(/^Like\./)[0];
    fireEvent(like, "pressIn");
    fireEvent(like, "pressOut");

    expect(await screen.findByText(/How everyone voted/i)).toBeTruthy();
    expect(await screen.findByText(/You · Liked/)).toBeTruthy();
    expect(await screen.findByText(`${before - 1} more reactions`)).toBeTruthy();
  });
});
