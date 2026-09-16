import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent } from "@testing-library/react-native";
import { act, renderRouter, screen } from "expo-router/testing-library";

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
    // Fake timers are what let VOTE_GRACE_MS (7s of real time) resolve
    // inside a test at all. Note what this does NOT do: manually drive the
    // clock via advanceTimersByTime/runOnlyPendingTimers after this point.
    // @testing-library/react-native's own findBy*/waitFor already advances
    // fake time in small act()-wrapped steps internally (see its
    // wait-for.js) to reach whatever it's waiting for — interleaving a
    // second, manual timer-advance after that corrupts the same act()
    // bookkeeping enough to silently drop the next dispatch. So the fix
    // is to let findByLabelText's own polling carry us to the commit,
    // by asserting on the specific post-commit value it's polling for,
    // not to drive the clock ourselves.
    jest.useFakeTimers();
    await renderRouter(APP, { initialUrl: "/" });

    // Read the count off the banner's own label — the number and the unit are
    // separate Text nodes, so no single text node carries both.
    const banner = await screen.findByLabelText(/^\d+ more reactions$/);
    const before = Number(String(banner.props.accessibilityLabel).match(/\d+/)![0]);
    expect(before).toBeGreaterThan(0);

    const like = screen.getAllByLabelText(/^Like\./)[0];
    // fireEvent auto-wraps in act(), but doesn't flush the microtask queue —
    // wrapping explicitly and awaiting it here settles the optimistic
    // "pending vote" render synchronously, so the two findBy* calls right
    // below resolve on their first synchronous check instead of needing
    // waitFor's own internal fake-timer-advancing loop to see it appear.
    // That loop is exactly what corrupts the *next* dispatch otherwise —
    // see the note above this test.
    await act(async () => {
      fireEvent(like, "pressIn");
      fireEvent(like, "pressOut");
    });

    // The reaction lands immediately, even though the vote is still cancellable.
    expect(screen.getByText(/How everyone voted/i)).toBeTruthy();
    expect(screen.getByText(/You · Liked/)).toBeTruthy();

    // The count only moves once the grace window closes and the vote commits.
    expect(screen.queryByLabelText(`${before - 1} more reactions`)).toBeNull();

    const counted = await screen.findByLabelText(`${before - 1} more reactions`);
    expect(
      Number(String(counted.props.accessibilityLabel).match(/\d+/)![0]),
    ).toBe(before - 1);
    jest.useRealTimers();
  });

  it("cancels a still-pending vote when the same direction is tapped again", async () => {
    // Regression: VoteControls' `committed` ref was only ever reset to false
    // at the top of begin() *after* an early-return check against its own
    // stale value from the previous press — so once any vote ever committed
    // on a button, every later press on it (including the second tap meant
    // to cancel a pending one) was silently swallowed, and onVote never
    // fired a second time at all.
    jest.useFakeTimers();
    await renderRouter(APP, { initialUrl: "/" });
    const banner = await screen.findByLabelText(/^\d+ more reactions$/);
    const before = Number(String(banner.props.accessibilityLabel).match(/\d+/)![0]);

    const like = screen.getAllByLabelText(/^Like\./)[0];
    await act(async () => {
      fireEvent(like, "pressIn");
      fireEvent(like, "pressOut");
    });
    expect(screen.getByText(/You · Liked/)).toBeTruthy();

    // Same direction, second tap, still within the grace window — cancels
    // rather than voting again.
    await act(async () => {
      fireEvent(like, "pressIn");
      fireEvent(like, "pressOut");
    });

    expect(screen.queryByText(/You · Liked/)).toBeNull();
    expect(screen.queryByText(/How everyone voted/i)).toBeNull();
    // The banner never moved — the cancelled vote never reached commitVote.
    expect(screen.getByLabelText(`${before} more reactions`)).toBeTruthy();
    jest.useRealTimers();
  });

  it("locks the buttons once the vote is counted", async () => {
    // See the note on the test above: fake timers are required for
    // VOTE_GRACE_MS to resolve at all, but the clock must only ever be
    // driven by findBy*/waitFor's own internal advancing — never manually
    // afterward, since interleaving both corrupts act() bookkeeping and
    // silently drops whichever dispatch comes next.
    jest.useFakeTimers();
    await renderRouter(APP, { initialUrl: "/" });
    await screen.findByLabelText(/^\d+ more reactions$/);

    const like = screen.getAllByLabelText(/^Like\./)[0];
    await act(async () => {
      fireEvent(like, "pressIn");
      fireEvent(like, "pressOut");
    });

    // The vote it landed on is final, and the other direction is inert.
    // findByLabelText's own internal fake-timer advancing is what carries
    // this across the grace window — nothing here drives the clock by hand.
    expect(await screen.findByLabelText(/This vote is final/)).toBeTruthy();
    const other = screen.getAllByLabelText(
      /unavailable, your vote is already counted/,
    )[0];

    const before = Number(
      String(screen.getByLabelText(/^\d+ more reactions$/).props.accessibilityLabel).match(/\d+/)![0],
    );
    // The other direction is disabled once locked — begin()/release() both
    // short-circuit on `disabled`, so this is a genuine no-op, not another
    // pending vote to wait out.
    await act(async () => {
      fireEvent(other, "pressIn");
      fireEvent(other, "pressOut");
    });
    const after = screen.getByLabelText(/^\d+ more reactions$/);
    expect(
      Number(String(after.props.accessibilityLabel).match(/\d+/)![0]),
    ).toBe(before);
    jest.useRealTimers();
  });
});
