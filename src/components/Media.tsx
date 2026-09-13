import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, G, Rect } from "react-native-svg";
import { hashSeed } from "@/lib/format";
import { nearestPoint } from "@/lib/grids";
import type { Scores } from "@/lib/types";
import { r as radius, squircle } from "@/theme/tokens";

/**
 * Real uploaded media when the post has any. Seeded posts have none, so they
 * fall back to a composition generated from their own grid scores — the same
 * numbers that drive the algorithm, deterministic per post id.
 *
 * The generated viewBox is 100 wide and as tall as the container needs. A fixed
 * square viewBox would be scaled to cover a phone-shaped reel, blowing the
 * shapes up to several times the screen.
 */
export function isVideoUrl(url?: string): boolean {
  return Boolean(url && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url));
}

export function Media({
  id,
  scores,
  mediaUrl,
  ratio = 4 / 5,
  fill = false,
  rounded = true,
  muted = true,
  playing = true,
  style,
}: {
  id: string;
  scores: Scores;
  /** Uploaded image or video. Falls back to generated art when absent. */
  mediaUrl?: string;
  /** width / height. Ignored when `fill` is set — the container decides. */
  ratio?: number;
  fill?: boolean;
  rounded?: boolean;
  /** Reels autoplay silently; a tap-to-unmute control belongs to the screen. */
  muted?: boolean;
  /** Only the reel actually on screen should be playing. */
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  const ground = nearestPoint("focus", scores.focus).hex!;
  const primary = nearestPoint("mind", scores.mind).hex!;
  const secondary = nearestPoint("culture", scores.culture).hex!;
  const accent = nearestPoint("soul", scores.soul).hex!;

  const isVideo = isVideoUrl(mediaUrl);
  const player = useVideoPlayer(isVideo ? mediaUrl! : null, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    if (!isVideo) return;
    if (playing) player.play();
    else player.pause();
  }, [isVideo, playing, player]);

  const a = hashSeed(id);
  const b = hashSeed(id + "b");
  const d = hashSeed(id + "c");

  const vbH = fill ? (box ? Math.max(40, (box.h / box.w) * 100) : 200) : 100 / ratio;
  const cx = 22 + a * 56;
  const cy = vbH * (0.22 + b * 0.5);
  const rad = 13 + d * 15;
  const barY = vbH * (0.12 + b * 0.66);
  const barH = 4 + d * 7;
  const tilt = -24 + a * 48;

  const onLayout = (e: LayoutChangeEvent) => {
    if (!fill) return;
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (box?.w !== width || box?.h !== height)) {
      setBox({ w: width, h: height });
    }
  };

  const frame: StyleProp<ViewStyle> = [
    fill
      ? { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }
      : { width: "100%", aspectRatio: ratio },
    { overflow: "hidden", backgroundColor: ground },
    rounded && !fill ? { borderRadius: radius.md, ...squircle } : null,
    style,
  ];

  if (mediaUrl) {
    return (
      <View onLayout={onLayout} style={frame}>
        {isVideo ? (
          <VideoView
            style={{ width: "100%", height: "100%" }}
            player={player}
            nativeControls={false}
            contentFit={fill ? "cover" : "contain"}
          />
        ) : (
          <Image
            source={{ uri: mediaUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit={fill ? "cover" : "cover"}
            transition={160}
          />
        )}
      </View>
    );
  }

  return (
    <View onLayout={onLayout} style={frame}>
      <Svg width="100%" height="100%" viewBox={`0 0 100 ${vbH}`} preserveAspectRatio="xMidYMid slice">
        <Rect width={100} height={vbH} fill={ground} />
        <G rotation={tilt} origin={`50, ${vbH / 2}`}>
          <Rect x={-40} y={barY} width={180} height={barH} fill={secondary} opacity={0.9} />
        </G>
        <Circle cx={cx} cy={cy} r={rad} fill={primary} opacity={0.92} />
        <Circle cx={cx} cy={cy} r={rad} fill="none" stroke={accent} strokeWidth={1.2} opacity={0.85} />
        <Circle cx={100 - cx} cy={vbH - cy} r={rad * 0.34} fill={accent} opacity={0.9} />
      </Svg>
    </View>
  );
}
