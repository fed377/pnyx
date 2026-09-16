import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { api } from "@/api/client";
import { useSession } from "./session";
import { useStore } from "./store";

/**
 * Registers this device for OS push notifications once signed in, in remote
 * mode only — there's no server to register a token with offline.
 *
 * Silently does nothing without an EAS project configured (no
 * `extra.eas.projectId` in app config): `getExpoPushTokenAsync` needs one to
 * resolve a token at all, and none exists yet for this app. The rest of the
 * plumbing (server storage, send-on-notify) is real and ready the moment one
 * is — nothing else needs to change.
 */
export function usePushRegistration() {
  const { mode } = useStore();
  const { session, token } = useSession();
  const remote = mode === "remote" && session !== null;
  const registered = useRef(false);

  useEffect(() => {
    if (!remote || registered.current || Platform.OS === "web") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    let cancelled = false;
    void (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== "granted") {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== "granted" || cancelled) return;

      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
      const t = await token();
      if (!t || cancelled) return;
      await api.registerPushToken(t, expoPushToken);
      registered.current = true;
    })().catch(() => {
      // Best-effort — a device that can't register for push still gets the
      // in-app inbox, which never depended on any of this.
    });

    return () => {
      cancelled = true;
    };
  }, [remote, token]);
}

/** Mount once near the root, alongside AuthGate — this hook has no UI of its own. */
export function PushRegistration() {
  usePushRegistration();
  return null;
}
