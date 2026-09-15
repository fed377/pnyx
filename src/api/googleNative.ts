import Constants, { AppOwnership } from "expo-constants";
import { Platform } from "react-native";

/**
 * The system Google account picker — @react-native-google-signin is a native
 * module, so it only exists in a custom dev build, never in Expo Go and never
 * on web. Everything here degrades to "not available" instead of throwing,
 * so `session.tsx` can fall back to the browser-based flow unconditionally.
 *
 * `appOwnership === "expo"` means literally running inside the Expo Go app —
 * unlike `executionEnvironment`, which reports the same "storeClient" value
 * for both Expo Go and a real expo-dev-client build, this is the one signal
 * that actually distinguishes "the native module cannot possibly exist" from
 * "it's a custom build and might." It's marked deprecated in favor of
 * executionEnvironment, but that replacement can't make this distinction, so
 * this is deliberate, not an oversight.
 */
const isExpoGo = Constants.appOwnership === AppOwnership.Expo;

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export const googleNativeConfigured = Platform.OS !== "web" && !isExpoGo && WEB_CLIENT_ID.length > 0;

let configured = false;

export type GoogleNativeResult =
  /** No native module (Expo Go / web) or no client id configured — caller
   * should silently fall back to the browser flow. */
  | { status: "unavailable" }
  /** The picker opened and the user backed out of it on purpose — caller
   * should report a cancellation, not retry via the browser. */
  | { status: "cancelled" }
  | { status: "ok"; idToken: string };

/** Runs the native Google account picker, when one exists. */
export async function signInWithGoogleNative(): Promise<GoogleNativeResult> {
  if (!googleNativeConfigured) return { status: "unavailable" };

  let GoogleSignin: typeof import("@react-native-google-signin/google-signin").GoogleSignin;
  try {
    // Deferred import: on Expo Go this package has no native module behind
    // it, so importing it eagerly at app startup would crash the bundle.
    ({ GoogleSignin } = await import("@react-native-google-signin/google-signin"));
  } catch {
    return { status: "unavailable" };
  }

  try {
    if (!configured) {
      GoogleSignin.configure({
        webClientId: WEB_CLIENT_ID,
        iosClientId: IOS_CLIENT_ID || undefined,
        offlineAccess: false,
      });
      configured = true;
    }

    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const result = await GoogleSignin.signIn();
    if (result.type === "cancelled") return { status: "cancelled" };
    const idToken = result.data?.idToken;
    return idToken ? { status: "ok", idToken } : { status: "unavailable" };
  } catch (e) {
    // A real SIGN_IN_CANCELLED from the native SDK also lands here on some
    // platforms rather than as result.type — treat it the same way.
    const code = (e as { code?: string })?.code;
    if (code === "SIGN_IN_CANCELLED") return { status: "cancelled" };
    // NATIVE_MODULE_NOT_FOUND (Expo Go / not a dev build) or a misconfigured
    // client id — fall back to the browser flow instead of dead-ending here.
    return { status: "unavailable" };
  }
}
