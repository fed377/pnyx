import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { VOTE_GRACE_MS } from "@/lib/algorithm";

const APP = "./src/app";

/** Every surface should mount and show its own content, not just a shell. */
const ROUTES: [url: string, expected: RegExp][] = [
  ["/", /more reactions/i],
  ["/feed", /^@[a-z0-9._]+$/i],
  ["/people", /Most aligned/i],
  ["/profile", /Five grids/i],
  ["/u/mara", /Mara Colombo/],
  ["/u/konsta", /Kept private/i],
  ["/settings", /Forget me/i],
  ["/stats", /reactions recorded/i],
  ["/messages", /Mara Colombo/],
  ["/messages/m1", /Exactly the complaint/i],
  ["/contribute", /Only Speakers can post/i],
  ["/notifications", /loved your take/i],
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
  it("shows the reaction at once, and counts it after the grace window", async () => {
    await renderRouter(APP, { initialUrl: "/" });

    // Read the count off the banner's own label — the number and the unit are
    // separate Text nodes, so no single text node carries both.
    const banner = await screen.findByLabelText(/^\d+ more reactions$/);
    const before = Number(String(banner.props.accessibilityLabel).match(/\d+/)![0]);
    expect(before).toBeGreaterThan(0);

    const like = screen.getAllByLabelText(/^Like\./)[0];
    fireEvent(like, "pressIn");
    fireEvent(like, "pressOut");

    // The reaction lands immediately, even though the vote is still cancellable.
    expect(await screen.findByText(/How everyone voted/i)).toBeTruthy();
    expect(await screen.findByText(/You · Liked/)).toBeTruthy();

    // The count only moves once the grace window closes and the vote commits.
    expect(screen.queryByLabelText(`${before - 1} more reactions`)).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(VOTE_GRACE_MS + 50);
    });
    // The commit dispatches from an async callback; let it settle.
    await act(async () => {
      await Promise.resolve();
    });

    const counted = await screen.findByLabelText(/^\d+ more reactions$/);
    expect(
      Number(String(counted.props.accessibilityLabel).match(/\d+/)![0]),
    ).toBe(before - 1);
  });

  it("locks the buttons once the vote is counted", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await screen.findByLabelText(/^\d+ more reactions$/);

    const like = screen.getAllByLabelText(/^Like\./)[0];
    fireEvent(like, "pressIn");
    fireEvent(like, "pressOut");
    await act(async () => {
      jest.advanceTimersByTime(VOTE_GRACE_MS + 50);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // The vote it landed on is final, and the other direction is inert.
    expect(await screen.findByLabelText(/This vote is final/)).toBeTruthy();
    const other = screen.getAllByLabelText(
      /unavailable, your vote is already counted/,
    )[0];

    const before = Number(
      String(
        (await screen.findByLabelText(/^\d+ more reactions$/)).props
          .accessibilityLabel,
      ).match(/\d+/)![0],
    );
    fireEvent(other, "pressIn");
    fireEvent(other, "pressOut");
    await act(async () => {
      jest.advanceTimersByTime(VOTE_GRACE_MS + 50);
      await Promise.resolve();
    });
    const after = await screen.findByLabelText(/^\d+ more reactions$/);
    expect(
      Number(String(after.props.accessibilityLabel).match(/\d+/)![0]),
    ).toBe(before);
  });
});
