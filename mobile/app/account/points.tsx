import type { LoyaltyAccount } from "@ovira/core";
import { myPoints, redeemPoints } from "@ovira/core";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";

import { PrimaryButton } from "../../src/components/form";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

/**
 * Loyalty points: the balance, what it is worth, and when it lapses.
 *
 * The worth is read from the server, never multiplied here. A point value saved
 * before the sanity guard existed once turned 61,016 points into six figures of
 * store credit on this very store, and the client is the last place that
 * arithmetic should be reproduced.
 */
export default function PointsScreen() {
  const { c, space } = useTheme();
  const t = dict();

  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const found = await myPoints(50);
    setAccount(found);
    setState(found ? "ready" : "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const redeem = useCallback(async () => {
    if (!account) return;
    setBusy(true);
    try {
      const result = await redeemPoints(account.balance);
      Alert.alert(t.redeem, fill(t.pointsRedeemed, { amount: money(result.value) }));
      await load();
    } catch (err) {
      Alert.alert(t.redeem, err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setBusy(false);
    }
  }, [account, load, t]);

  if (state === "loading") {
    return (
      <>
        <Stack.Screen options={{ title: t.points }} />
        <Screen scroll={false}>
          <Loading />
        </Screen>
      </>
    );
  }

  if (state === "failed") {
    return (
      <>
        <Stack.Screen options={{ title: t.points }} />
        <Screen scroll={false}>
          <Empty icon="cloud-offline-outline" title={t.loadFailed} onRetry={() => void load()} />
        </Screen>
      </>
    );
  }

  if (!account?.enabled) {
    return (
      <>
        <Stack.Screen options={{ title: t.points }} />
        <Screen scroll={false}>
          <Empty icon="star-outline" title={t.pointsOff} />
        </Screen>
      </>
    );
  }

  const min = account.min_redeem ?? 0;
  const canRedeem = account.balance > 0 && account.balance >= min;

  return (
    <>
      <Stack.Screen options={{ title: t.points }} />
      <Screen>
        <VStack gap="xl">
          <Card>
            <VStack gap="sm" style={{ alignItems: "center" }}>
              <Txt variant="display" tone="blue">
                {num(account.balance)}
              </Txt>
              <Txt variant="caption" tone="faint">
                {fill(t.pointsWorth, { amount: money(account.redeemable_value ?? 0) })}
              </Txt>
              {!!account.next_expiry_on && !!account.next_expiry_points && (
                <Txt variant="caption" tone="coral" style={{ textAlign: "center" }}>
                  {fill(t.pointsExpiring, {
                    n: num(account.next_expiry_points),
                    date: formatDate(account.next_expiry_on),
                  })}
                </Txt>
              )}
            </VStack>
          </Card>

          <VStack gap="sm">
            <PrimaryButton
              label={t.redeemAll}
              icon="swap-horizontal-outline"
              onPress={() => void redeem()}
              busy={busy}
              disabled={!canRedeem}
            />
            {!canRedeem && min > 0 && (
              <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
                {fill(t.pointsMin, { n: num(min) })}
              </Txt>
            )}
          </VStack>

          {!account.entries.length ? (
            <Empty icon="time-outline" title={t.noEntries} />
          ) : (
            <VStack gap="md">
              {account.entries.map((entry) => {
                const earned = entry.points > 0;
                return (
                  <View key={entry.name}>
                    <Row justify="space-between" align="flex-start">
                      <VStack gap="xs" style={{ flex: 1 }}>
                        <Txt variant="label">{entry.reason || entry.entry_type}</Txt>
                        <Txt variant="caption" tone="faint">
                          {formatDate(entry.creation)}
                        </Txt>
                      </VStack>
                      <Txt variant="label" tone={earned ? "mint" : "coral"}>
                        {earned ? "+" : "−"}
                        {num(Math.abs(entry.points))}
                      </Txt>
                    </Row>
                    <View style={{ height: 1, backgroundColor: c.line, marginTop: space.md }} />
                  </View>
                );
              })}
            </VStack>
          )}
        </VStack>
      </Screen>
    </>
  );
}
