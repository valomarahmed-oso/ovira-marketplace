import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";

import { PrimaryButton } from "./components/form";
import { Logo } from "./components/logo";
import { Screen, Txt, VStack } from "./components/ui";
import { useDevicePrefs } from "./device-prefs";
import { dict } from "./i18n";

/**
 * A fingerprint or face between someone else and this shopper's account.
 *
 * Worth being exact about what this protects: order history, saved addresses,
 * store credit and points — everything on a phone that is handed to a child or
 * left on a desk. It is **not** a second factor. The Frappe session in the
 * cookie jar is what authenticates to the server, and a local check cannot and
 * should not pretend otherwise.
 *
 * It re-locks when the app has been in the background, not on every render, so
 * flicking to WhatsApp and back does not become an interrogation.
 */
const GRACE_MS = 60_000;

export async function biometricsAvailable(): Promise<boolean> {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  // Hardware without an enrolled fingerprint is a promise the phone cannot
  // keep: offering the toggle would lock the shopper out of their own app.
  return hardware && enrolled;
}

export function AppLock({ children }: { children: ReactNode }) {
  const enabled = useDevicePrefs((s) => s.appLock);
  const hydrated = useDevicePrefs((s) => s.hydrated);
  const t = dict();

  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setChecking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.unlockPrompt,
        cancelLabel: t.cancel,
        // Falling back to the device passcode matters: a wet thumb or a mask
        // should not mean "you cannot open the app you paid through".
        disableDeviceFallback: false,
      });
      if (result.success) setLocked(false);
    } finally {
      setChecking(false);
    }
  }, [t]);

  // Lock as soon as the setting is on and the stored answer has arrived.
  useEffect(() => {
    if (hydrated && enabled) setLocked(true);
    if (!enabled) setLocked(false);
  }, [hydrated, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== "active") return;
      const away = Date.now() - (backgroundedAt.current ?? Date.now());
      // A quick trip to the camera roll or a copied verification code is not a
      // new session. A minute away is.
      if (away > GRACE_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  // Ask for the fingerprint as soon as the screen goes up, so the shopper
  // isn't made to press a button before being asked anyway.
  useEffect(() => {
    if (locked && !checking) void unlock();
    // Deliberately not depending on `unlock` — it changes with the dictionary
    // and would re-prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  if (!locked) return <>{children}</>;

  return (
    <Screen scroll={false} style={{ alignItems: "center", justifyContent: "center" }}>
      <VStack gap="xl" style={{ alignItems: "center" }}>
        <Logo size={64} />
        <Txt variant="heading">{t.locked}</Txt>
        <View style={{ width: 220 }}>
          <PrimaryButton
            label={t.unlock}
            icon="finger-print-outline"
            onPress={() => void unlock()}
            busy={checking}
          />
        </View>
      </VStack>
    </Screen>
  );
}
