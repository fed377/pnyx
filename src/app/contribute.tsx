import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PageHeader } from "@/components/Chrome";
import { Icon } from "@/components/Icon";
import { Btn } from "@/components/Primitives";
import { useToast } from "@/components/Toast";
import { GRID_LIST } from "@/lib/grids";
import type { GridId } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, f, r, s, squircle } from "@/theme/tokens";

type Step = "categories" | "warning" | "compose";

type Picked = {
  uri: string;
  kind: "image" | "video";
  mediaType: string;
};

/** What the picker hands back, mapped onto the types the API accepts. */
function mimeFor(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = asset.uri.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "mov") return "video/quicktime";
  if (ext === "mp4") return "video/mp4";
  return asset.type === "video" ? "video/mp4" : "image/jpeg";
}

function Preview({ picked }: { picked: Picked }) {
  const player = useVideoPlayer(picked.kind === "video" ? picked.uri : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  if (picked.kind === "video") {
    return <VideoView style={styles.preview} player={player} nativeControls={false} contentFit="cover" />;
  }
  return <Image source={{ uri: picked.uri }} style={styles.preview} contentFit="cover" />;
}

const WARNINGS = [
  ["This affects your score.", "Everything you publish is scored on the same five grids your own position sits on."],
  ["This is a serious app.", "PNYX is for what you actually think, not for engagement bait."],
  ["Opinions only.", "Posts go through moderation and the terms of service before they reach anyone's feed."],
  ["You can't vote on your own post.", "Other people decide where it sits."],
] as const;

const MAX = 220;

export default function ContributeScreen() {
  const { state, publish, accent, accentSoft } = useStore();
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("categories");
  const [picked, setPicked] = useState<GridId[]>([]);
  const [media, setMedia] = useState<Picked | null>(null);
  const [text, setText] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  // The keyboard overlays the screen rather than resizing it, so the scroller
  // needs to know how much room it is losing at the bottom.
  const scroller = useRef<ScrollView>(null);
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (state.profile.tier !== "speaker") {
    return (
      <View style={styles.screen}>
        <PageHeader title="Contribute" />
        <View style={styles.content}>
          <View style={styles.gate}>
            <Icon name="lock" size={22} color={c.textFaint} />
            <Text style={styles.gateTitle}>Only Speakers can post</Text>
            <Text style={styles.gateBody}>
              Posting puts an opinion in front of everyone and it gets scored like any other. That&apos;s reserved for
              the Speaker tier, so the people posting are the people willing to be public about it.
            </Text>
            <Btn label="Change my visibility" variant="accent" onPress={() => router.push("/settings")} />
          </View>
        </View>
      </View>
    );
  }

  const toggle = (g: GridId) =>
    setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast("PNYX needs access to your library to post");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      videoMaxDuration: 90,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setMedia({
      uri: asset.uri,
      kind: asset.type === "video" ? "video" : "image",
      mediaType: mimeFor(asset),
    });
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || picked.length === 0 || !media) return;
    setBusy(true);
    try {
      // The server scores the post; the client no longer guesses at it.
      await publish({
        type: media.kind,
        body,
        categories: picked,
        fileUri: media.uri,
        mediaType: media.mediaType,
      });
      toast("Posted. It's in the queue for moderation.");
      router.replace("/profile");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not post that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageHeader title="Contribute" />
      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.content, { paddingBottom: s[7] + keyboard }]}
        // "handled" keeps the keyboard up while you scroll and still lets a tap
        // on a button register; dismiss-on-drag would close it mid-scroll.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "categories" && (
          <>
            <Text style={styles.title}>What is this about?</Text>
            <Text style={styles.lead}>
              Pick the grids your post actually touches. It decides which part of everyone&apos;s profile it can move.
            </Text>
            <View style={{ gap: s[2] }}>
              {GRID_LIST.map((grid) => {
                const on = picked.includes(grid.id);
                return (
                  <Pressable
                    key={grid.id}
                    onPress={() => toggle(grid.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[styles.cat, on && { backgroundColor: accentSoft }]}
                  >
                    <View style={[styles.mark, on && { backgroundColor: accent }]}>
                      {on && <Icon name="check" size={14} color={c.onAccent} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catLabel}>{grid.label}</Text>
                      <Text style={styles.catAxes}>
                        {grid.axisX.neg} ↔ {grid.axisX.pos} · {grid.axisY.neg} ↔ {grid.axisY.pos}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Btn
              label="Continue"
              variant="accent"
              wide
              disabled={picked.length === 0}
              onPress={() => setStep("warning")}
            />
          </>
        )}

        {step === "warning" && (
          <>
            <Text style={styles.title}>Before you post</Text>
            <View style={{ gap: s[3] }}>
              {WARNINGS.map(([head, body]) => (
                <View key={head} style={[styles.warn, { borderLeftColor: accent }]}>
                  <Text style={styles.warnHead}>{head}</Text>
                  <Text style={styles.warnBody}>{body}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actions}>
              <Btn label="Back" onPress={() => setStep("categories")} style={{ flex: 1 }} />
              <Btn label="I understand" variant="accent" onPress={() => setStep("compose")} style={{ flex: 1 }} />
            </View>
          </>
        )}

        {step === "compose" && (
          <>
            <Text style={styles.title}>Say it plainly</Text>

            <Pressable
              onPress={() => void pick()}
              accessibilityRole="button"
              accessibilityLabel={media ? "Change the photo or video" : "Choose a photo or video"}
              style={styles.picker}
            >
              {media ? (
                <>
                  <Preview picked={media} />
                  <Text style={styles.pickerSwap}>
                    {media.kind === "video" ? "Video" : "Photo"} selected · tap to change
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="plus" size={22} color={c.textFaint} />
                  <Text style={styles.pickerLabel}>Choose a photo or video</Text>
                  <Text style={styles.pickerHint}>Every post carries something to look at.</Text>
                </>
              )}
            </Pressable>

            <View>
              <Text style={styles.fieldLabel}>Your take</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MAX}
                accessibilityLabel="Your take"
                style={styles.textarea}
                // Bring the field and the Post button above the keyboard.
                onFocus={() => setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120)}
              />
              <Text style={styles.counter}>{MAX - text.length} characters left</Text>
            </View>
            <Pressable
              onPress={() => setAgreed((a) => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              style={styles.check}
            >
              <View style={[styles.mark, agreed && { backgroundColor: accent }]}>
                {agreed && <Icon name="check" size={14} color={c.onAccent} />}
              </View>
              <Text style={styles.checkLabel}>I&apos;ve read the terms and this is my own opinion.</Text>
            </Pressable>
            <View style={styles.actions}>
              <Btn label="Back" onPress={() => setStep("warning")} style={{ flex: 1 }} />
              <Btn
                label={busy ? "Posting…" : "Post"}
                variant="accent"
                disabled={!agreed || !media || busy || text.trim().length < 8}
                onPress={() => void submit()}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  content: { padding: s[4], gap: s[4] },
  title: { color: c.text, fontSize: f.xl, fontWeight: "600", letterSpacing: -0.4 },
  lead: { color: c.textDim, fontSize: f.sm, lineHeight: 20, marginTop: -s[2] },
  cat: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: s[3],
    padding: s[3],
    borderRadius: r.md,
    backgroundColor: c.surface2,
    ...squircle,
  },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: c.surface3,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    ...squircle,
  },
  catLabel: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  catAxes: { color: c.textDim, fontSize: f.xs, marginTop: 2 },
  warn: {
    paddingVertical: s[3],
    paddingHorizontal: s[4],
    borderLeftWidth: 2,
    backgroundColor: c.surface,
    borderTopRightRadius: r.sm,
    borderBottomRightRadius: r.sm,
    ...squircle,
  },
  warnHead: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  warnBody: { color: c.textDim, fontSize: f.sm, lineHeight: 19, marginTop: 2 },
  actions: { flexDirection: "row", gap: s[2] },
  fieldLabel: {
    color: c.textFaint,
    fontSize: f.xs,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  textarea: {
    color: c.text,
    fontSize: f.md,
    minHeight: 120,
    textAlignVertical: "top",
    padding: s[3],
    borderRadius: r.sm,
    backgroundColor: c.surface2,
    ...squircle,
  },
  counter: { color: c.textFaint, fontSize: f.xs, textAlign: "right", marginTop: s[2] },
  picker: {
    alignItems: "center",
    justifyContent: "center",
    gap: s[2],
    padding: s[4],
    minHeight: 180,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: r.md,
    backgroundColor: c.surface,
    overflow: "hidden",
    ...squircle,
  },
  pickerLabel: { color: c.text, fontSize: f.sm, fontWeight: "600" },
  pickerHint: { color: c.textFaint, fontSize: f.xs },
  pickerSwap: { color: c.textDim, fontSize: f.xs, marginTop: s[2] },
  preview: { width: "100%", height: 220, borderRadius: r.sm, backgroundColor: c.surface2, ...squircle },
  check: { flexDirection: "row", alignItems: "center", gap: s[3] },
  checkLabel: { color: c.textDim, fontSize: f.sm, flex: 1 },
  gate: {
    alignItems: "flex-start",
    gap: s[3],
    padding: s[5],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: r.lg,
    ...squircle,
  },
  gateTitle: { color: c.text, fontSize: f.lg, fontWeight: "600" },
  gateBody: { color: c.textDim, fontSize: f.sm, lineHeight: 20 },
});
