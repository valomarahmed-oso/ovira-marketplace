import { buyerReport, reportDate, type BuyerReport } from "@ovira/core";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { statusLabel } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

const RANGES = [30, 90, 365] as const;
type Range = (typeof RANGES)[number];

/**
 * What this shopper has actually spent, over a window they choose.
 *
 * Everything here is computed server-side from their own orders — the client
 * picks two dates and renders what comes back. Summing order totals on the
 * device would be a second place where money is added up, and the two would
 * eventually disagree.
 */
export default function ReportsScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const user = useSession((s) => s.user);

  const [days, setDays] = useState<Range>(30);
  const [report, setReport] = useState<BuyerReport | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!user) {
      setState("ready");
      return;
    }
    setState("loading");
    setReport(await buyerReport(reportDate(days), reportDate(0)));
    setState("ready");
  }, [user, days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: t.reports }} />
        <Screen>
          <Empty icon="stats-chart-outline" title={t.signInFirst} body={t.reportsSignIn} />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.reports }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Row gap="sm">
            {RANGES.map((option) => {
              const on = days === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setDays(option)}
                  style={{
                    backgroundColor: on ? c.blue : c.surface,
                    borderColor: on ? c.blue : c.line,
                    borderWidth: 1,
                    borderRadius: radius.pill,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.sm,
                  }}
                >
                  <Txt variant="caption" tone={on ? "onBlue" : "muted"}>
                    {fill(t.vendorPeriod, { n: num(option) })}
                  </Txt>
                </Pressable>
              );
            })}
          </Row>

          {state === "loading" ? (
            <Loading />
          ) : !report ? (
            <Empty icon="stats-chart-outline" title={t.loadFailed} onRetry={() => void load()} />
          ) : (
            <>
              <Row gap="md">
                <Stat label={t.reportOrders} value={num(report.summary.orders)} />
                <Stat label={t.reportSpent} value={money(report.summary.spent)} />
              </Row>
              <Row gap="md">
                <Stat label={t.reportPaid} value={num(report.summary.paid_orders)} />
                <Stat label={t.reportAov} value={money(report.summary.aov)} />
              </Row>

              {report.by_status.length > 0 && (
                <Card>
                  <VStack gap="md">
                    <Txt variant="label">{t.reportByStatus}</Txt>
                    {report.by_status.map((row) => (
                      <Row key={row.status} justify="space-between">
                        <Txt variant="body" tone="muted">
                          {statusLabel(row.status)}
                        </Txt>
                        <Txt variant="body">{num(row.cnt)}</Txt>
                      </Row>
                    ))}
                  </VStack>
                </Card>
              )}

              {report.top_products.length > 0 && (
                <Card>
                  <VStack gap="md">
                    <Txt variant="label">{t.reportTopProducts}</Txt>
                    {report.top_products.map((row, index) => (
                      <Row key={`${row.title}-${index}`} justify="space-between" align="flex-start">
                        <VStack gap="xs" style={{ flex: 1 }}>
                          <Txt variant="body" numberOfLines={2}>
                            {row.title}
                          </Txt>
                          <Txt variant="caption" tone="faint">
                            {num(row.qty)} {t.qty}
                          </Txt>
                        </VStack>
                        <Txt variant="label" tone="blue">
                          {money(row.spent)}
                        </Txt>
                      </Row>
                    ))}
                  </VStack>
                </Card>
              )}

              <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
                {formatDate(report.from_date)} — {formatDate(report.to_date)}
              </Txt>
            </>
          )}
        </VStack>
      </Screen>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Card>
        <VStack gap="xs">
          <Txt variant="caption" tone="faint">
            {label}
          </Txt>
          <Txt variant="heading" tone="blue" numberOfLines={1}>
            {value}
          </Txt>
        </VStack>
      </Card>
    </View>
  );
}
