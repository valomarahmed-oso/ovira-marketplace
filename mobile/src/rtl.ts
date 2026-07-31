import { I18nManager, Platform } from "react-native";

/**
 * Arabic-first means right-to-left is the app's normal direction, not a mode it
 * can be talked into.
 *
 * Two mechanisms cover the two ways this app runs:
 *
 * - **Built app** — the `expo-localization` config plugin sets `forcesRTL` in
 *   the native project, so the very first frame is already RTL.
 * - **Expo Go / dev** — config plugins don't apply, so we ask at runtime. On
 *   native this lands on the *next* reload (React Native reads the flag while
 *   the bridge starts, and during development a reload is a keystroke away);
 *   on react-native-web it applies immediately.
 *
 * Layout code should therefore just write `flexDirection: "row"` and let the
 * framework flip it. Hand-flipping to `row-reverse` looks right today and
 * double-flips the day the build turns RTL on properly.
 */
export function ensureRtl(): void {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }

  // react-native-web resolves direction from the document, not from
  // I18nManager, so the flag above changes nothing there on its own. Saying it
  // twice is not redundancy — it is the same intent expressed to the two
  // renderers that each own half of it.
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  }
}

/** True once the direction the layout was written for is actually in force. */
export function isRtlActive(): boolean {
  return I18nManager.isRTL;
}
