/**
 * Registering a device for push.
 *
 * Two transports exist on the server and they are not interchangeable: browsers
 * subscribe with a VAPID endpoint, the app registers an Expo token. Only the
 * app-side calls live here, because a browser's subscription is created by its
 * own Service Worker and never travels through this package.
 */

import { post } from "./http.js";

const NS = "ovira_marketplace.api.push";

export type DeviceInfo = {
  token: string;
  platform?: "ios" | "android" | "other";
  deviceName?: string;
  appVersion?: string;
};

/**
 * Claim this device for the signed-in shopper.
 *
 * Re-registering is expected and cheap — the server keys on the token, refreshes
 * `last_seen`, and **moves** the device to whoever is signed in now. That last
 * part matters on a shared phone: without it, the first person's order updates
 * would keep arriving for the second.
 */
export async function registerDevice(info: DeviceInfo): Promise<void> {
  await post(
    `${NS}.register_device`,
    {
      token: info.token,
      platform: info.platform,
      device_name: info.deviceName,
      app_version: info.appVersion,
    },
    "تعذّر تفعيل الإشعارات.",
  );
}

/** Give up the device — on sign-out, or when notifications are switched off. */
export async function unregisterDevice(token: string): Promise<void> {
  await post(`${NS}.unregister_device`, { token }, "تعذّر إيقاف الإشعارات.");
}
