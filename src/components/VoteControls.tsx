import type { VotePower } from "@/lib/types";
import { c, f, hexToRgba, s } from "@/theme/tokens";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Icon } from "./Icon";

/** Press-and-hold duration for Love / Hate (spec §4.1). */
export const HOLD_MS = 1500;
/**
 * Vertical rhythm of the reel rail. Exported so the buttons the rail adds
 * around this one (comments, share) keep the same spacing instead of drifting.
 */
export const RAIL_GAP = s[3];
/** Gap between a rail glyph and the label under it. */
export const RAIL_LABEL_GAP = 4;
/** Point in the hold where the icon flips to the strong reaction. */
const PREVIEW_AT = 0.55;
/** iOS HIG minimum tappable target — the visible glyph can (and here does)
 * stay smaller; hitSlop makes up the difference invisibly. */
const MIN_TOUCH = 44;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Dir = 1 | -1;

/** Pops the glyph the moment a direction settles as the current vote — a vote should land with a beat. */
function usePop(active: boolean) {
  const scale = useSharedValue(1);
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) {
      scale.value = withSequence(
        withTiming(1.3, { duration: 90 }),
        withSpring(1, { damping: 9, stiffness: 220 }),
      );
    }
    was.current = active;
  }, [active, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

export function VoteControls({
  current,
  pendingUntil,
  onVote,
  layout = "row",
  size = 42,
  disabled = false,
  locked = false,
  onLockedPress,
  overlay = false,
  counts,
}: {
  current?: VotePower;
  /** Timestamp this content's pending vote commits at, if one is pending. */
  pendingUntil?: number;
  onVote: (power: VotePower) => void;
  /** "pill" is a labeled capsule (icon + count) for a card sitting on a dark surface. */
  layout?: "row" | "rail" | "pill";
  size?: number;
  /** Your own post — every call site uses this for exactly that, never any
   * other reason, so it renders as a static "Your post" label instead of a
   * dimmed-but-still-pressable vote control (a guaranteed-failure tap
   * otherwise invites itself every time you scroll past your own content). */
  disabled?: boolean;
  /** The vote has committed and can no longer be changed. */
  locked?: boolean;
  onLockedPress?: () => void;
  /** Sits on top of a reel, so the buttons need their own contrast. */
  overlay?: boolean;
  /** Shown next to the glyph in "pill" layout — the global up/down split, as a
   * percentage of this post's own votes (0-100), *not* a raw vote count. A
   * lightly-voted post can legitimately read "100" here (100% of its
   * handful of votes went one way), which is why this renders with a "%"
   * rather than through `compactCount` (built for genuinely large numbers). */
  counts?: { up: number; down: number };
}) {
  const [holding, setHolding] = useState<Dir | null>(null);
  const [preview, setPreview] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const pendingProgress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const pendingAnim = useRef<Animated.CompositeAnimation | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = useRef(false);
  // True once the current press has been dragged outside the button during a
  // hold. Previously nothing let you back out of a hold once started — an
  // early release still committed a light vote, and letting the 1.5s timer
  // run out always committed a permanent Love/Hate, with no way to abort
  // either. Dragging off is the recognized native pattern for "changed my
  // mind" mid-press; see onTouchMove below.
  const draggedOff = useRef(false);
  const popUp = usePop(current === 2 || current === 1);
  const popDown = usePop(current === -2 || current === -1);

  // Fills over whatever time is left until the pending vote commits — if this
  // mounts mid-window (scrolled back to a reel voted on earlier), it fills
  // over just the remainder rather than the full grace period.
  useEffect(() => {
    pendingAnim.current?.stop();
    if (pendingUntil === undefined) {
      pendingProgress.setValue(0);
      return;
    }
    const remaining = Math.max(0, pendingUntil - Date.now());
    pendingProgress.setValue(0);
    pendingAnim.current = Animated.timing(pendingProgress, {
      toValue: 1,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    pendingAnim.current.start();
    // pendingProgress is a stable ref value (same Animated.Value instance for
    // the component's lifetime) — it never needs to be a dependency here.
  }, [pendingUntil]);

  const clearTimers = useCallback(() => {
    anim.current?.stop();
    anim.current = null;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const commit = useCallback(
    (power: VotePower) => {
      committed.current = true;
      clearTimers();
      setHolding(null);
      setPreview(false);
      progress.setValue(0);
      onVote(power);
    },
    [clearTimers, onVote, progress],
  );

  // Stops the hold and commits nothing — `clearTimers()` stops the
  // in-flight Animated.timing, so its own completion callback fires with
  // `finished: false` and the `if (finished) commit(...)` guard in begin()
  // below never runs. This is the only path that ends a press with no vote
  // at all, light or strong.
  const cancel = useCallback(() => {
    clearTimers();
    setHolding(null);
    setPreview(false);
    progress.setValue(0);
  }, [clearTimers, progress]);

  const begin = useCallback(
    (dir: Dir) => {
      // Reset for this press cycle — `committed` only exists to stop
      // `release()` from double-firing `commit()` after the hold timer
      // already did (see its own check below), *within* one press. Checking
      // it here before resetting would instead carry the previous press's
      // "already committed" flag forward forever, silently swallowing every
      // press after the very first one on this button ever committed —
      // including the second tap meant to cancel a still-pending vote.
      committed.current = false;
      draggedOff.current = false;
      setHolding(dir);
      setPreview(false);
      progress.setValue(0);
      previewTimer.current = setTimeout(
        () => setPreview(true),
        HOLD_MS * PREVIEW_AT,
      );
      anim.current = Animated.timing(progress, {
        toValue: 1,
        duration: HOLD_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      anim.current.start(({ finished }) => {
        if (finished) commit(dir === 1 ? 2 : -2);
      });
    },
    [commit, progress],
  );

  const release = useCallback(
    (dir: Dir) => {
      // Already cancelled by onTouchMove — state is already reset, and the
      // finger lifting outside the button shouldn't retroactively vote.
      if (draggedOff.current) return;
      clearTimers();
      setHolding(null);
      setPreview(false);
      progress.setValue(0);
      if (!committed.current) commit(dir === 1 ? 1 : -1);
    },
    [clearTimers, commit, progress],
  );

  // Your own post: nothing here is ever votable, so nothing here is
  // pressable — a static label, not a dimmed button that still invites a
  // guaranteed-failure tap every time you scroll past your own content.
  if (disabled) {
    return (
      <View style={styles.ownPost}>
        <Text style={[styles.ownPostText, (overlay || layout === "pill") && styles.ownPostTextOverlay]}>
          Your post
        </Text>
      </View>
    );
  }

  // On the rail the button box hugs the glyph, so the gaps in the stylesheet
  // are the gaps you see; the padding that would have made the target big
  // enough moves into hitSlop instead. Row and pill both render at `size`
  // itself, and pill in particular ships at 38 (feed.tsx/PhotoViewer) —
  // below the 44pt minimum — so the same hitSlop top-up applies there too,
  // not just on the rail.
  const glyph = Math.round(size * 0.6);
  const box = layout === "rail" ? glyph : size;
  const slop = Math.max(0, Math.round((MIN_TOUCH - box) / 2));

  const ringR = box / 2 + 2;
  const circ = 2 * Math.PI * ringR;

  const renderButton = (dir: Dir) => {
    const strong: VotePower = dir === 1 ? 2 : -2;
    const light: VotePower = dir === 1 ? 1 : -1;
    const active = current === strong || current === light;
    const isStrong = current === strong;
    const isHolding = holding === dir;
    const isPending = active && pendingUntil !== undefined;
    const tone = dir === 1 ? c.up : c.down;

    const showStrongIcon = isStrong || (isHolding && preview);
    const iconName = showStrongIcon
      ? dir === 1
        ? "heart"
        : "heartBreak"
      : dir === 1
        ? "thumbUp"
        : "thumbDown";

    const label = isStrong
      ? dir === 1
        ? "Loved"
        : "Hated"
      : active
        ? dir === 1
          ? "Liked"
          : "Disliked"
        : dir === 1
          ? "Like"
          : "Dislike";

    // No chrome around the button, and no colour on the glyph either — a vote
    // reads as a *filled* icon rather than a tinted one. The progress ring is
    // the only thing that carries the direction's colour.
    const fg = overlay || layout === "pill" ? c.onAccent : active || isHolding ? c.text : c.textDim;
    // A settled vote keeps its full presence; the road not taken fades out.
    const opacity = locked && !active ? 0.28 : 1;
    const count = layout === "pill" ? (dir === 1 ? counts?.up : counts?.down) : undefined;
    // The accessibilityLabel below already says "tap again to cancel" — a
    // sighted user gets no equivalent unless the cancel window shows up
    // somewhere visible too, so the pill's existing text slot (normally the
    // %) and the rail's existing caption both say "Undo" for the direction
    // that's actually pending.
    const sideText = layout === "pill" ? (isPending ? "Undo" : count !== undefined ? `${count}%` : undefined) : undefined;
    const belowCaption = layout === "rail" ? label : layout === "row" && isPending ? "Undo" : undefined;

    return (
      <View key={dir} style={styles.slot}>
        <Pressable
          // Pressable's own `disabled` swallows the press outright, which would
          // also swallow the chance to explain why nothing happened.
          onPressIn={() => {
            if (locked) return onLockedPress?.();
            begin(dir);
          }}
          onPressOut={() => {
            if (locked) return;
            release(dir);
          }}
          // Dragging off mid-hold cancels rather than committing — the
          // recognized native "changed my mind" gesture. Only matters while
          // this specific button is the one being held; a generous margin
          // (matching the button's own hitSlop) avoids canceling on the
          // ordinary small finger drift a real hold always has.
          onTouchMove={(e) => {
            if (locked || holding !== dir || draggedOff.current) return;
            const { locationX, locationY } = e.nativeEvent;
            const margin = slop + 8;
            if (locationX < -margin || locationX > box + margin || locationY < -margin || locationY > box + margin) {
              draggedOff.current = true;
              cancel();
            }
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: locked, selected: active }}
          accessibilityLabel={
            locked
              ? active
                ? `${label}. This vote is final.`
                : `${dir === 1 ? "Like" : "Dislike"} — unavailable, your vote is already counted.`
              : isPending
                ? `${dir === 1 ? "Liked" : "Disliked"}, not yet final. Tap again to cancel.`
                : `${dir === 1 ? "Like" : "Dislike"}. Tap to ${
                    dir === 1 ? "like" : "dislike"
                  }, hold for one and a half seconds to ${dir === 1 ? "love" : "hate"}.`
          }
          hitSlop={slop}
          style={[
            styles.btn,
            layout === "pill"
              ? [styles.pillBtn, { height: box, borderRadius: box / 2, opacity }]
              : { width: box, height: box, opacity },
            layout === "row" && !overlay && { borderWidth: 1.5, borderColor: c.line, borderRadius: box / 2 },
          ]}
        >
          {(isHolding || isPending) && layout !== "pill" && (
            <View style={[StyleSheet.absoluteFill, styles.ring]}>
              <Svg
                width={ringR * 2 + 6}
                height={ringR * 2 + 6}
                viewBox={`0 0 ${ringR * 2 + 6} ${ringR * 2 + 6}`}
              >
                <AnimatedCircle
                  cx={ringR + 3}
                  cy={ringR + 3}
                  r={ringR}
                  fill="none"
                  stroke={tone}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={`${circ}`}
                  strokeDashoffset={(isHolding
                    ? progress
                    : pendingProgress
                  ).interpolate({
                    inputRange: [0, 1],
                    outputRange: [circ, 0],
                  })}
                  transform={`rotate(-90 ${ringR + 3} ${ringR + 3})`}
                />
              </Svg>
            </View>
          )}
          <Reanimated.View style={dir === 1 ? popUp : popDown}>
            <Icon
              name={iconName}
              size={glyph}
              color={fg}
              filled={active || isHolding}
            />
          </Reanimated.View>
          {sideText !== undefined && <Text style={styles.pillCount}>{sideText}</Text>}
        </Pressable>
        {belowCaption !== undefined && (
          <Text style={[styles.caption, (overlay || layout === "pill") && styles.captionOverlay]}>
            {belowCaption}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={layout === "rail" ? styles.rail : styles.row}>
      {renderButton(1)}
      {renderButton(-1)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: s[2] },
  rail: { flexDirection: "column", alignItems: "center", gap: RAIL_GAP },
  slot: { alignItems: "center", gap: RAIL_LABEL_GAP },
  btn: { alignItems: "center", justifyContent: "center" },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: s[3],
    borderWidth: 1.5,
    borderColor: hexToRgba(c.onAccent, 0.4),
  },
  pillCount: { color: c.onAccent, fontSize: f.sm, fontWeight: "600" },
  ring: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  // Readable on a light card by default (the only place "row" is actually
  // used); the overlay variant below is for a dark/reel surface instead.
  caption: {
    color: c.textDim,
    fontSize: f.xs,
    fontWeight: "500",
  },
  captionOverlay: { color: "rgba(236,237,243,0.85)" },
  ownPost: { justifyContent: "center", paddingVertical: s[2] },
  ownPostText: { color: c.textFaint, fontSize: f.sm, fontWeight: "600" },
  // On a dark/overlay surface c.textFaint reads too close to the background.
  ownPostTextOverlay: { color: hexToRgba(c.onAccent, 0.6) },
});
