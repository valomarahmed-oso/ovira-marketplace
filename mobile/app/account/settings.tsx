import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { biometricsAvailable } from "../../src/app-lock";
import { Toggle } from "../../src/components/form";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { useDevicePrefs } from "../../src/device-prefs";
import { dict } from "../../src/i18n";
import { usePush } from "../../src/use-push";
import { useTheme } from "../../src/theme-context";

/**
 * The two switches that belong to this phone.
 *
 * Both say *why* they are unavailable when they are. "App lock" greyed out with
 * no explanation reads as a bug; "this phone has no fingerprint enrolled" reads
 * as an instruction.
 */
export default function SettingsScreen() {
  const { c, space } = useTheme();
  const t = dict();

  const { state, wanted, setWanted } = usePush();
  const appLock = useDevicePrefs((s) => s.appLock);
  const setAppLock = useDevicePrefs((s) => s.setAppLock);

  const [biometrics, setBiometrics] = useState<boolean | null>(null);
  useEffect(() => {
    void biometricsAvailable().then(setBiometrics);
  }, []);

  const pushNote =
    state === "denied"
      ? t.notificationsDenied
      : state === "unavailable"
        ? t.notificationsUnbuilt
        : t.notificationsHint;

  return (
    <>
      <Stack.Screen options={{ title: t.settings }} />
      <Screen>
        <VStack gap="lg">
          <Card>
            <VStack gap="md">
              <Toggle
                label={t.notifications}
                hint={pushNote}
                value={wanted}
                onChange={setWanted}
              />
              {state === "denied" && (
                // The app cannot re-ask once iOS has been told no; the only
                // route back is the system settings, so say so and open them.
                <Pressable onPress={() => void Linking.openSettings()}>
                  <Row gap="xs">
                    <Ionicons name="open-outline" size={14} color={c.blue} />
                    <Txt variant="caption" tone="blue">
                      {t.settings}
                    </Txt>
                  </Row>
                </Pressable>
              )}
              {state === "on" && (
                <Row gap="xs">
                  <Ionicons name="checkmark-circle" size={14} color={c.mint} />
                  <Txt variant="caption" tone="mint">
                    {t.notificationsOn}
                  </Txt>
                </Row>
              )}
            </VStack>
          </Card>

          <Card>
            <VStack gap="sm">
              <Toggle
                label={t.appLock}
                hint={biometrics === false ? t.appLockUnavailable : t.appLockHint}
                value={appLock}
                onChange={setAppLock}
                disabled={biometrics !== true}
              />
            </VStack>
          </Card>

          <View style={{ height: space.lg }} />
        </VStack>
      </Screen>
    </>
  );
}
