import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { UNLOCK_AT, VOTE_GRACE_MS } from "@/lib/algorithm";
import { MIN_AGE, toBirthDate, toISODate } from "@/lib/birthday";
import { GRID_LIST } from "@/lib/grids";
import type { GridId, Point, VotePower } from "@/lib/types";
import { useSession } from "@/state/session";
import { useStore } from "@/state/store";
import { enter } from "@/theme/motion";
import { c, display, f, r, s, squircle } from "@/theme/tokens";
import { AlignmentDial } from "./Alignment";
import { AnimatedPressable } from "./AnimatedPressable";
import { BirthdayField } from "./BirthdayField";
import { GridPlot } from "./GridPlot";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { FORM_KEYBOARD_BEHAVIOR } from "./keyboard";
import { AnimalPreview } from "./Landing";
import { Btn, Progress } from "./Primitives";
import { VoteControls } from "./VoteControls";

type PageId = "react" | "reactions" | "grids" | "type" | "alignment" | "app" | "birthday";

/**
 * The welcome tour: what PNYX does with your reactions, the four reactions,
 * the five grids, the 50-reaction unlock, alignment, and where everything
 * lives. `first` runs once per account after sign-up, asks for a birthday
 * when the account has none (a Google sign-up), and marks the tour done on
 * the server. `replay` is the same tour opened from Settings.
 */
export function Onboarding({ mode, onClose }: { mode: "first" | "replay"; onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { needsBirthday, completeOnboarding, dispatch } = useStore();
  const { signOut } = useSession();

  const pages: PageId[] = ["react", "reactions", "grids", "type", "alignment", "app"];
  if (mode === "first" && needsBirthday) pages.push("birthday");
  const last = pages.length - 1;

  const listRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });
  const [page, setPage] = useState(0);
  // Visuals that animate on arrival (the alignment dial) mount when first reached.
  const [reached, setReached] = useState(0);
  const goTo = (index: number) => {
    listRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
    setReached((r) => Math.max(r, index));
  };

  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const birth = toBirthDate(day, month, year);
  const dateInvalid = day.length > 0 && month.length > 0 && year.length === 4 && !birth;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooYoung, setTooYoung] = useState(false);

  const finish = async () => {
    if (mode === "replay") {
      onClose?.();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding(pages.includes("birthday") && birth ? toISODate(birth) : undefined);
      router.navigate("/feed");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setTooYoung(true);
      else setError(e instanceof Error ? e.message : "Couldn't finish setting up. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await signOut();
    dispatch({ type: "forget" });
  };

  const onBirthday = pages[page] === "birthday";
  const primaryLabel =
    page < last ? "Next" : mode === "replay" ? "Done" : busy ? "Setting up…" : "Start reacting";
  const primaryDisabled = busy || (onBirthday && !birth);

  if (tooYoung) {
    return (
      <View style={[styles.screen, styles.blocked, { paddingTop: insets.top + s[7], paddingBottom: insets.bottom + s[5] }]}>
        <Text style={styles.title} accessibilityRole="header">
          You need to be {MIN_AGE} or older
        </Text>
        <Text style={styles.body}>
          PNYX isn&apos;t available to people under {MIN_AGE}. If you entered your birthday by mistake, go back and
          check it.
        </Text>
        <View style={styles.blockedActions}>
          <Btn label="Check my birthday" onPress={() => setTooYoung(false)} wide />
          <Btn label="Sign out" variant="outline" onPress={() => void leave()} wide />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={FORM_KEYBOARD_BEHAVIOR}
      style={[styles.screen, { paddingTop: insets.top + s[3], paddingBottom: insets.bottom + s[4] }]}
    >
      <View style={styles.top}>
        <View style={styles.segments} accessibilityLabel={`Step ${page + 1} of ${pages.length}`}>
          {pages.map((id, i) => (
            <Segment key={id} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>
        {mode === "replay" ? (
          <AnimatedPressable
            onPress={onClose}
            hitSlop={10}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.topAction}
          >
            <Icon name="close" size={18} color={c.text} />
          </AnimatedPressable>
        ) : (
          page < last &&
          !onBirthday && (
            <AnimatedPressable
              onPress={() => (pages.includes("birthday") ? goTo(last) : void finish())}
              hitSlop={10}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel="Skip the tour"
              style={styles.topAction}
            >
              <Text style={styles.skip}>Skip</Text>
            </AnimatedPressable>
          )
        )}
      </View>

      <Animated.ScrollView
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(index);
          setReached((r) => Math.max(r, index));
        }}
      >
        {pages.map((id, i) => (
          <ScrollView
            key={id}
            style={{ width }}
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {id === "react" && <ReactPage />}
            {id === "reactions" && <ReactionsPage />}
            {id === "grids" && <GridsPage active={page === i} />}
            {id === "type" && <TypePage />}
            {id === "alignment" && <AlignmentPage reached={reached >= i} />}
            {id === "app" && <AppPage />}
            {id === "birthday" && (
              <BirthdayPage
                day={day}
                setDay={setDay}
                month={month}
                setMonth={setMonth}
                year={year}
                setYear={setYear}
                invalid={dateInvalid}
              />
            )}
          </ScrollView>
        ))}
      </Animated.ScrollView>

      <View style={styles.foot}>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.footRow}>
          {page > 0 && (
            <Btn label="Back" variant="outline" onPress={() => goTo(page - 1)} disabled={busy} style={styles.back} />
          )}
          <Btn
            label={primaryLabel}
            variant="accent"
            onPress={() => (page < last ? goTo(page + 1) : void finish())}
            disabled={primaryDisabled}
            style={styles.next}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** One step of the progress bar, filling as the pages scroll past. */
function Segment({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const fill = useAnimatedStyle(() => {
    const p = width > 0 ? scrollX.get() / width : 0;
    return { width: `${interpolate(p - index + 1, [0, 1], [0, 100], "clamp")}%` };
  });
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

function Page({ title, children, visual }: { title: string; children: ReactNode; visual?: ReactNode }) {
  return (
    <View style={styles.pageInner}>
      {visual && <View style={styles.visual}>{visual}</View>}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function ReactPage() {
  return (
    <Page title="No quiz. Just react." visual={<AnimalPreview />}>
      <Text style={styles.body}>
        PNYX works out what you&apos;re like from how you react to posts and reels. There&apos;s nothing to fill in
        and nothing to pretend. The more you react, the clearer the picture gets.
      </Text>
    </Page>
  );
}

const DEMO_RESULT: Record<VotePower, string> = {
  1: "Like. You move a little toward this post.",
  2: "Love. You move twice as far toward it.",
  [-1]: "Dislike. You move a little away from it.",
  [-2]: "Hate. You move twice as far away.",
};

function ReactionsPage() {
  const [vote, setVote] = useState<VotePower | undefined>(undefined);
  return (
    <Page title="Four ways to react">
      <Text style={styles.body}>
        Tap for Like or Dislike. Hold for a second and a half for Love or Hate, which count twice as much.
      </Text>
      <View style={styles.demo}>
        <VoteControls current={vote} size={60} onVote={(power) => setVote((v) => (v === power ? undefined : power))} />
        <Animated.Text
          key={vote ?? "none"}
          entering={enter.fade()}
          style={styles.demoResult}
          accessibilityLiveRegion="polite"
        >
          {vote === undefined ? "Try it: tap one, then hold one." : DEMO_RESULT[vote]}
        </Animated.Text>
      </View>
      <Text style={styles.note}>
        Changed your mind? Tap the same button again within {Math.round(VOTE_GRACE_MS / 1000)} seconds to undo it.
        After that the reaction counts. You can&apos;t react to your own posts.
      </Text>
    </Page>
  );
}

/** Where each grid's dot sits, drifting so the plots show movement. */
function useDriftingPoints(active: boolean): Record<GridId, Point> {
  const reduceMotion = useReducedMotion();
  const [points, setPoints] = useState<Record<GridId, Point>>(() => ({
    values: { x: 0.35, y: -0.2 },
    mind: { x: -0.3, y: 0.4 },
    soul: { x: 0.1, y: 0.5 },
    culture: { x: -0.45, y: -0.3 },
    focus: { x: 0.5, y: 0.25 },
  }));
  useEffect(() => {
    if (!active || reduceMotion) return;
    const id = setInterval(() => {
      setPoints((prev) => {
        const next = { ...prev };
        for (const g of GRID_LIST) {
          const p = prev[g.id];
          const step = () => (Math.random() - 0.5) * 0.5;
          next[g.id] = {
            x: Math.max(-0.8, Math.min(0.8, p.x + step())),
            y: Math.max(-0.8, Math.min(0.8, p.y + step())),
          };
        }
        return next;
      });
    }, 1400);
    return () => clearInterval(id);
  }, [active, reduceMotion]);
  return points;
}

function GridsPage({ active }: { active: boolean }) {
  const points = useDriftingPoints(active);
  return (
    <Page title="Five grids, one you">
      <Text style={styles.body}>
        Every post is placed on five grids before anyone sees it. Each reaction pulls you toward where the post
        sits, or pushes you away from it.
      </Text>
      <View style={styles.list}>
        {GRID_LIST.map((g) => (
          <View key={g.id} style={styles.gridRow}>
            <GridPlot gridId={g.id} position={points[g.id]} size={56} labels={false} accent={c.text} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{g.label}</Text>
              <Text style={styles.rowText}>
                {g.axisX.neg} to {g.axisX.pos}
              </Text>
              <Text style={styles.rowText}>
                {g.axisY.neg} to {g.axisY.pos}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}

function TypePage() {
  const { mode, voteCount } = useStore();
  return (
    <Page title={`Your type unlocks at ${UNLOCK_AT}`}>
      <Text style={styles.body}>
        After {UNLOCK_AT} reactions you get your type: an animal, its colours and a code you can share. Until then it
        stays hidden, so it rests on more than a few taps.
      </Text>
      <View style={styles.list}>
        {GRID_LIST.map((g) => (
          <View key={g.id} style={styles.mapRow}>
            <Text style={styles.rowTitle}>{g.label}</Text>
            <Text style={styles.mapValue}>{g.determines}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        It keeps moving as you do. Recent reactions count most, and older ones fade out. Statistics shows how
        you&apos;ve moved on each grid over time.
      </Text>
      {mode === "remote" && voteCount < UNLOCK_AT && (
        <View style={styles.progress}>
          <Text style={styles.rowText}>
            You&apos;re at {voteCount} of {UNLOCK_AT}.
          </Text>
          <Progress value={voteCount / UNLOCK_AT} />
        </View>
      )}
    </Page>
  );
}

function AlignmentPage({ reached }: { reached: boolean }) {
  return (
    <Page
      title="Find the people closest to you"
      visual={<View style={styles.dial}>{reached && <AlignmentDial value={86} size={104} />}</View>}
    >
      <Text style={styles.body}>
        Alignment is how close you sit to someone across all five grids, from 0 to 100%. You&apos;ll see it on
        profiles, in People and in Messages.
      </Text>
      <Bullet>People shows the most aligned people in the world, and lets you search everyone.</Bullet>
      <Bullet>The alignment filter on Home hides posts from people below a level you choose.</Bullet>
      <Bullet>In Settings you decide which of your grids other people can compare against.</Bullet>
    </Page>
  );
}

const PLACES: { icon: IconName; title: string; text: string }[] = [
  { icon: "home", title: "Home", text: "Posts from people you follow, and hot takes: short opinions at the top." },
  { icon: "feed", title: "Feed", text: "Reels picked for where you are now, plus a few from the other side." },
  { icon: "people", title: "People", text: "Search, and the people most aligned with you." },
  { icon: "profile", title: "Profile", text: "Your type, your code, and what you've loved and hated." },
  { icon: "stats", title: "Statistics", text: "How you've moved on each grid, and how rare your type is." },
  { icon: "message", title: "Messages", text: "Share a post into a chat and your reaction goes with it." },
  { icon: "plus", title: "Post", text: "Speakers can post. Every post is checked before anyone sees it." },
  { icon: "settings", title: "Settings", text: "Choose how visible you are: Speaker, Active or Private." },
];

function AppPage() {
  return (
    <Page title="Where everything is">
      <View style={styles.list}>
        {PLACES.map((p) => (
          <View key={p.title} style={styles.placeRow}>
            <View style={styles.placeIcon}>
              <Icon name={p.icon} size={18} color={c.text} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{p.title}</Text>
              <Text style={styles.rowText}>{p.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}

function BirthdayPage(props: {
  day: string;
  setDay: (v: string) => void;
  month: string;
  setMonth: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <Page title="One last thing">
      <Text style={styles.body}>
        PNYX is for people {MIN_AGE} and over, so we need your birthday. It&apos;s never shown on your profile.
      </Text>
      <BirthdayField {...props} />
    </Page>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletDot} />
      <Text style={[styles.rowText, styles.bulletText]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  top: { flexDirection: "row", alignItems: "center", gap: s[3], paddingHorizontal: s[5], minHeight: 36 },
  segments: { flex: 1, flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: r.full, backgroundColor: c.surface3, overflow: "hidden" },
  segmentFill: { height: "100%", borderRadius: r.full, backgroundColor: c.text },
  topAction: { minWidth: 36, height: 36, alignItems: "flex-end", justifyContent: "center" },
  skip: { color: c.textDim, fontSize: f.sm, fontWeight: "600" },
  page: { flexGrow: 1, paddingHorizontal: s[5], paddingTop: s[6], paddingBottom: s[5] },
  pageInner: { gap: s[4] },
  visual: { alignItems: "center", marginBottom: s[2] },
  title: { color: c.text, fontSize: 32, lineHeight: 36, fontFamily: display.bold, letterSpacing: -0.5 },
  body: { color: c.textDim, fontSize: f.md, lineHeight: 22 },
  note: { color: c.textFaint, fontSize: f.sm, lineHeight: 19 },
  demo: {
    alignItems: "center",
    gap: s[4],
    paddingVertical: s[5],
    paddingHorizontal: s[4],
    borderRadius: r.lg,
    backgroundColor: c.surface,
    ...squircle,
  },
  demoResult: { color: c.text, fontSize: f.md, fontWeight: "600", textAlign: "center", minHeight: 22 },
  list: { gap: s[3] },
  gridRow: { flexDirection: "row", alignItems: "center", gap: s[3] },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: c.text, fontSize: f.md, fontWeight: "600" },
  rowText: { color: c.textDim, fontSize: f.sm, lineHeight: 19 },
  mapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: s[2],
    borderBottomWidth: 1,
    borderBottomColor: c.lineSoft,
  },
  mapValue: { color: c.textDim, fontSize: f.sm },
  progress: { gap: s[2] },
  dial: { height: 104, justifyContent: "center" },
  bullet: { flexDirection: "row", gap: s[3], alignItems: "flex-start" },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.text, marginTop: 7 },
  bulletText: { flex: 1 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: s[3] },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: r.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface2,
    ...squircle,
  },
  foot: { paddingHorizontal: s[5], paddingTop: s[3], gap: s[2] },
  footRow: { flexDirection: "row", gap: s[2] },
  back: { flex: 1, minHeight: 50 },
  next: { flex: 2, minHeight: 50 },
  error: { color: c.down, fontSize: f.sm, textAlign: "center" },
  blocked: { paddingHorizontal: s[5], gap: s[4], justifyContent: "center" },
  blockedActions: { gap: s[2], marginTop: s[3] },
});
