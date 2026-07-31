import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Choices that belong to the phone, not the account.
 *
 * Push and the app lock are properties of *this device*: a shopper who wants a
 * fingerprint on their own phone does not want one on a shared tablet, and
 * turning notifications off here should not silence them everywhere they are
 * signed in. Keeping them local also means they survive signing out, which is
 * what someone expects of a setting they set on their own phone.
 */
type DevicePrefs = {
  /** What the shopper asked for. Whether the OS agrees is a separate question. */
  pushWanted: boolean;
  /** The token currently registered with the store, so it can be released. */
  pushToken: string | null;
  appLock: boolean;
  hydrated: boolean;

  setPushWanted: (wanted: boolean) => void;
  setPushToken: (token: string | null) => void;
  setAppLock: (on: boolean) => void;
};

export const useDevicePrefs = create<DevicePrefs>()(
  persist(
    (set) => ({
      // Notifications default ON as an intent, but nothing is asked of the OS
      // until the shopper has done something that makes the request make sense
      // — see `usePushRegistration`. Defaulting the *intent* off would mean
      // most people never see order updates at all.
      pushWanted: true,
      pushToken: null,
      appLock: false,
      hydrated: false,

      setPushWanted: (pushWanted) => set({ pushWanted }),
      setPushToken: (pushToken) => set({ pushToken }),
      setAppLock: (appLock) => set({ appLock }),
    }),
    {
      name: "ovira-device",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        pushWanted: state.pushWanted,
        pushToken: state.pushToken,
        appLock: state.appLock,
      }),
      // Nothing gated on these settings may run before the stored answer is
      // back — asking for a fingerprint from someone who switched it off, even
      // once, is exactly the kind of thing that gets an app deleted.
      onRehydrateStorage: () => () => {
        useDevicePrefs.setState({ hydrated: true });
      },
    },
  ),
);
