import { useCallback, useEffect, useState } from "react";

import { useDevicePrefs } from "./device-prefs";
import { claimDevice, obtainPushToken, prepareChannels, releaseDevice } from "./notifications";
import { useSession } from "./session";

/**
 * Keeps the store's idea of "where to reach this shopper" in step with the
 * phone's.
 *
 * Registration is tied to **being signed in**, not to opening the app. A guest
 * has no account to attach a device to, and asking a first-time visitor for
 * notification permission before they have done anything is how an app gets
 * that permission denied permanently — iOS never shows the dialog twice.
 */
export type PushState = "off" | "on" | "denied" | "unavailable";

export function usePush(): {
  state: PushState;
  wanted: boolean;
  setWanted: (on: boolean) => void;
  reason: string | null;
} {
  const user = useSession((s) => s.user);
  const hydrated = useDevicePrefs((s) => s.hydrated);
  const wanted = useDevicePrefs((s) => s.pushWanted);
  const token = useDevicePrefs((s) => s.pushToken);
  const setPushWanted = useDevicePrefs((s) => s.setPushWanted);
  const setPushToken = useDevicePrefs((s) => s.setPushToken);

  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    void prepareChannels();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;

    void (async () => {
      // Signed out, or switched off: give the device back so the previous
      // account's order updates stop arriving on this phone.
      if (!user || !wanted) {
        if (token) {
          await releaseDevice(token).catch(() => {});
          if (alive) setPushToken(null);
        }
        return;
      }

      const result = await obtainPushToken();
      if (!alive) return;
      if (!result.token) {
        setReason(result.reason ?? "unavailable");
        return;
      }
      setReason(null);
      // Re-registering an unchanged token is intentional: it refreshes
      // `last_seen` and moves the device to whoever is signed in now.
      await claimDevice(result.token).catch(() => {});
      if (alive) setPushToken(result.token);
    })();

    return () => {
      alive = false;
    };
  }, [hydrated, user, wanted, token, setPushToken]);

  const setWanted = useCallback(
    (on: boolean) => {
      setPushWanted(on);
      if (on) setReason(null);
    },
    [setPushWanted],
  );

  const state: PushState = !wanted
    ? "off"
    : reason === "denied"
      ? "denied"
      : reason
        ? "unavailable"
        : token
          ? "on"
          : "off";

  return { state, wanted, setWanted, reason };
}
