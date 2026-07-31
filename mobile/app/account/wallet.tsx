import type { Wallet } from "@ovira/core";
import { getWallet } from "@ovira/core";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, money } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

/**
 * Store credit, and where every piastre of it came from.
 *
 * The ledger is not decoration. Three customers on this store were refunded
 * into a balance they had no way to see, and concluded their money had
 * vanished. A balance without its entries is the same failure with a nicer
 * font.
 */
export default function WalletScreen() {
  const { c, space } = useTheme();
  const t = dict();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  const load = useCallback(async () => {
    const purse = await getWallet(50);
    setWallet(purse);
    // `null` here means the read failed, which is a different thing from a zero
    // balance and must not be shown as one.
    setState(purse ? "ready" : "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: t.wallet }} />
      <Screen>
        {state === "loading" ? (
          <Loading />
        ) : state === "failed" ? (
          <Empty icon="cloud-offline-outline" title={t.walletUnknown} onRetry={() => void load()} />
        ) : (
          <VStack gap="xl">
            <Card>
              <VStack gap="xs" style={{ alignItems: "center" }}>
                <Txt variant="caption" tone="faint">
                  {t.walletBalanceLabel}
                </Txt>
                <Txt variant="display" tone="blue">
                  {money(wallet?.balance ?? 0)}
                </Txt>
              </VStack>
            </Card>

            {!wallet?.entries.length ? (
              <Empty icon="time-outline" title={t.noEntries} />
            ) : (
              <VStack gap="md">
                {wallet.entries.map((entry) => {
                  const credit = entry.entry_type?.toLowerCase() === "credit";
                  return (
                    <View key={entry.name}>
                      <Row justify="space-between" align="flex-start">
                        <VStack gap="xs" style={{ flex: 1 }}>
                          <Txt variant="label">{entry.reason || entry.entry_type}</Txt>
                          <Txt variant="caption" tone="faint">
                            {formatDate(entry.creation)}
                          </Txt>
                          {!!entry.note && (
                            <Txt variant="caption" tone="faint">
                              {entry.note}
                            </Txt>
                          )}
                        </VStack>
                        <Txt variant="label" tone={credit ? "mint" : "coral"}>
                          {credit ? "+" : "−"}
                          {money(Math.abs(entry.amount))}
                        </Txt>
                      </Row>
                      <View style={{ height: 1, backgroundColor: c.line, marginTop: space.md }} />
                    </View>
                  );
                })}
              </VStack>
            )}
          </VStack>
        )}
      </Screen>
    </>
  );
}
