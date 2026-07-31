import { registerDevice, unregisterDevice } from "@ovira/core";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Order updates on the lock screen — the one thing a wrapped website cannot do.
 *
 * The whole flow is deliberately quiet about failure. A shopper who declines
 * the permission, an emulator with no push service, an Expo project id that
 * isn't set yet: none of these are errors the person using the app can act on,
 * and none of them should ever surface as a red message over their shopping.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Order updates are worth interrupting for; this store does not send
    // anything else to a phone.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Android groups notifications into channels the user can silence individually.
 * Declaring ours means "order updates" can be kept while anything else is
 * muted — and without it Android files everything under a default channel with
 * no name.
 */
export async function prepareChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("orders", {
    name: "تحديثات الطلبات",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    sound: "default",
  });
}

/** The Expo project this build belongs to — required to mint a push token. */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/** A token, or the reason there isn't one. Never both, never neither. */
export type PushRegistration = { token: string | null; reason?: string };

/**
 * Ask for permission and mint a token.
 *
 * Never asks twice: if the shopper has already answered, `getPermissionsAsync`
 * says so and the prompt is skipped. Repeatedly asking is how an app gets
 * permanently denied on iOS — the system stops showing the dialog after the
 * first refusal, so a second `requestPermissions` is not a second chance.
 */
export async function obtainPushToken(): Promise<PushRegistration> {
  if (!Device.isDevice) return { token: null, reason: "simulator" };

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted" && existing.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return { token: null, reason: "denied" };

  const id = projectId();
  if (!id) return { token: null, reason: "no-project-id" };

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return { token: data };
  } catch (err) {
    return { token: null, reason: err instanceof Error ? err.message : "token-failed" };
  }
}

/** Hand the token to the store, so it knows where to send this shopper's updates. */
export async function claimDevice(token: string): Promise<void> {
  await registerDevice({
    token,
    platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other",
    deviceName: Device.deviceName ?? undefined,
    appVersion: Constants.expoConfig?.version ?? undefined,
  });
}

/**
 * Release the device.
 *
 * Called on sign-out. Skipping it is how a phone keeps receiving the previous
 * account's order updates — the token outlives the session, so somebody has to
 * say it no longer belongs to them.
 */
export async function releaseDevice(token: string): Promise<void> {
  await unregisterDevice(token);
}

/** The storefront path the server attached, if any. */
export function urlFromNotification(
  response: Notifications.NotificationResponse | null,
): string | null {
  const data = response?.notification?.request?.content?.data as { url?: string } | undefined;
  return data?.url ?? null;
}
