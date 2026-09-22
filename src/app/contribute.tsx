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
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/Icon";
import { Btn, Chip, IconTile } from "@/components/Primitives";
import { useToast } from "@/components/Toast";
import { TERMS_URL } from "@/api/client";
import { GRID_LIST } from "@/lib/grids";
import type { GridId } from "@/lib/types";
import { useStore } from "@/state/store";
import { c, display, f, r, s, squircle } from "@/theme/tokens";

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
    return <VideoView style={styles.thumb} player={player} nativeControls={false} contentFit="cover" />;
  }
  return <Image source={{ uri: picked.uri }} style={styles.thumb} contentFit="cover" />;
}

const MAX = 220;

export default function ContributeScreen() {
  const { state, submitPost } = useStore();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [picked, setPicked] = useState<GridId[]>([]);
  const [media, setMedia] = useState<Picked | null>(null);
  const [text, setText] = useState("");

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
        <View style={[styles.header, { paddingTop: insets.top + s[2] }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.headerSide}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Contribute</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.content}>
          <View style={styles.gate}>
            <Icon name="lock" size={22} color={c.text} />
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

  const canPost = text.trim().length >= 8 && picked.length > 0 && media !== null;

  // Posting runs in the background from here — the server scores the post,
  // the client no longer guesses at it — so this returns to wherever you
  // came from immediately instead of blocking on the upload; the persistent
  // PostStatusSnackbar (mounted at the root) tracks progress from there.
  const submit = () => {
    const body = text.trim();
    if (!canPost || !media) return;
    submitPost({
      type: media.kind,
      body,
      categories: picked,
      fileUri: media.uri,
      mediaType: media.mediaType,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + s[2] }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.headerSide}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Contribute</Text>
        <Pressable
          onPress={submit}
          disabled={!canPost}
          accessibilityRole="button"
          accessibilityLabel="Post"
        >
          <Text style={[styles.headerSide, styles.headerPost, !canPost && styles.headerPostDisabled]}>Post</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.content, { paddingBottom: s[7] + keyboard }]}
        // "handled" keeps the keyboard up while you scroll and still lets a tap
        // on a button register; dismiss-on-drag would close it mid-scroll.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warn}>
          <Icon name="filter" size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnHead}>Opinions only.</Text>
            <Text style={styles.warnBody}>
              Posting affects your score. This is a serious app — posts go through moderation and the terms of
              service, and you can&apos;t vote on your own take.
            </Text>
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>What is it mostly about?</Text>
          <View style={styles.chipRow}>
            {GRID_LIST.map((grid) => (
              <Chip key={grid.id} label={grid.label} selected={picked.includes(grid.id)} onPress={() => toggle(grid.id)} />
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Your take</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX}
            placeholder="Say what you really think."
            placeholderTextColor={c.textFaint}
            accessibilityLabel="Your take"
            style={styles.textarea}
            // Bring the field above the keyboard.
            onFocus={() => setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120)}
          />
          <Text style={styles.counter}>{MAX - text.length} characters left</Text>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Add a photo or video</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
            <AnimatedPressable
              onPress={() => void pick()}
              scaleTo={0.93}
              style={styles.addTile}
              accessibilityRole="button"
              accessibilityLabel={media ? "Change the photo or video" : "Choose a photo or video"}
            >
              <IconTile icon="plus" size={32} />
            </AnimatedPressable>
            {media && (
              <AnimatedPressable onPress={() => void pick()} scaleTo={0.96} accessibilityRole="button" accessibilityLabel="Change photo">
                <Preview picked={media} />
              </AnimatedPressable>
            )}
          </ScrollView>
        </View>

        <Text style={styles.footnote}>
          Respect moderation. By posting you accept{" "}
          <Text
            style={styles.footnoteLink}
            accessibilityRole="link"
            onPress={() => TERMS_URL && void WebBrowser.openBrowserAsync(TERMS_URL)}
          >
            the terms
          </Text>
          . You cannot vote on your own take.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.app },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: s[4],
    paddingBottom: s[2],
  },
  headerTitle: { color: c.text, fontSize: f.md, fontFamily: display.semibold },
  headerSide: { color: c.textDim, fontSize: f.sm, minWidth: 50 },
  headerPost: { color: c.text, fontWeight: "600", textAlign: "right" },
  headerPostDisabled: { color: c.textFaint },
  content: { padding: s[4], gap: s[4] },
  warn: {
    flexDirection: "row",
    gap: s[3],
    padding: s[4],
    borderRadius: r.lg,
    backgroundColor: c.text,
    ...squircle,
  },
  warnHead: { color: c.app, fontSize: f.md, fontFamily: display.semibold },
  warnBody: { color: "rgba(255,255,255,0.7)", fontSize: f.xs, lineHeight: 17, marginTop: 2 },
  fieldLabel: { color: c.text, fontSize: f.sm, fontWeight: "600", marginBottom: s[2] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: s[2] },
  textarea: {
    color: c.text,
    fontSize: f.md,
    fontFamily: display.regular,
    minHeight: 120,
    textAlignVertical: "top",
    padding: s[3],
    borderRadius: r.md,
    backgroundColor: c.surface,
    ...squircle,
  },
  counter: { color: c.textFaint, fontSize: f.xs, textAlign: "right", marginTop: s[2] },
  mediaRow: { gap: s[2], paddingRight: s[4] },
  addTile: {
    width: 72,
    height: 72,
    borderRadius: r.md,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    ...squircle,
  },
  thumb: { width: 72, height: 72, borderRadius: r.md, backgroundColor: c.surface2, ...squircle },
  footnote: { color: c.textFaint, fontSize: f.xs, lineHeight: 17 },
  footnoteLink: { textDecorationLine: "underline" },
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
