import { vendorAnalytics, type VendorAnalytics } from "@ovira/core";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { statusLabel } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

/** The windows the endpoint accepts; anything else it silently rounds to 30. */
const WINDOWS = [7, 30, 90] as const;

/**
 * What the store is doing, and which way.
 *
 * The trend is drawn as bars rather than a line chart: on a phone the useful
 * question is "which days were good", not "what is the gradient", and a bar a
 * finger can be put on answers it without a charting dependency.
 */
export default function VendorAnalyticsScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const access = useVendorAccess();

  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [data, setData] = useState<VendorAnalytics | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    setState("loading");
    setData(await vendorAnalytics(days));
    setState("ready");
  }, [access, days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vaTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="stats-chart-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vaTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Row gap="sm">
            {WINDOWS.map((option) => {
              const on = days === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setDays(option)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    backgroundColor: on ? c.blue : c.surface,
                    borderColor: on ? c.blue : c.line,
                    borderWidth: 1,
                    borderRadius: radius.pill,
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
          ) : !data ? (
            <Empty icon="stats-chart-outline" title={t.loadFailed} onRetry={() => void load()} />
          ) : (
            <>
              <Card>
                <VStack gap="md">
                  <Txt variant="label">{fill(t.vendorPeriod, { n: num(days) })}</Txt>
                  <Row gap="md">
                    <Metric label={t.vaRevenue} value={money(data.period.revenue)} />
                    <Metric label={t.vendorOrdersCount} value={num(data.period.orders)} />
                    <Metric label={t.vendorUnits} value={num(data.period.units)} />
                  </Row>
                </VStack>
              </Card>

              <Trend rows={data.trend} />

              <Card>
                <VStack gap="md">
                  <Txt variant="label">{t.vaLifetime}</Txt>
                  <Row justify="space-between">
                    <Txt variant="body" tone="muted">
                      {t.vendorGross}
                    </Txt>
                    <Txt variant="label">{money(data.totals.gross_sales)}</Txt>
                  </Row>
                  <Row justify="space-between">
                    <Txt variant="body" tone="muted">
                      {t.vendorCommission}
                    </Txt>
                    <Txt variant="label" tone="coral">
                      −{money(data.totals.commission)}
                    </Txt>
                  </Row>
                  <View style={{ height: 1, backgroundColor: c.line }} />
                  <Row justify="space-between">
                    <Txt variant="heading">{t.vendorNetEarnings}</Txt>
                    <Txt variant="title" tone="mint">
                      {money(data.totals.net_earnings)}
                    </Txt>
                  </Row>
                  <Row justify="space-between">
                    <Txt variant="body" tone="muted">
                      {t.vaAov}
                    </Txt>
                    <Txt variant="label">{money(data.totals.avg_order_value)}</Txt>
                  </Row>
                </VStack>
              </Card>

              {data.top_products.length > 0 && (
                <Card>
                  <VStack gap="md">
                    <Txt variant="label">{t.vaTopProducts}</Txt>
                    {data.top_products.map((row) => (
                      <Row key={row.product} justify="space-between" align="flex-start">
                        <VStack gap="xs" style={{ flex: 1 }}>
                          <Txt variant="body" numberOfLines={2}>
                            {row.title}
                          </Txt>
                          <Txt variant="caption" tone="faint">
                            {num(row.qty)} {t.vendorUnits}
                          </Txt>
                        </VStack>
                        <Txt variant="label" tone="blue">
                          {money(row.revenue)}
                        </Txt>
                      </Row>
                    ))}
                  </VStack>
                </Card>
              )}

              {data.status_breakdown.length > 0 && (
                <Card>
                  <VStack gap="md">
                    <Txt variant="label">{t.reportByStatus}</Txt>
                    {data.status_breakdown.map((row) => (
                      <Row key={row.status} justify="space-between">
                        <Txt variant="body" tone="muted">
                          {statusLabel(row.status)}
                        </Txt>
                        <Txt variant="body">{num(row.count)}</Txt>
                      </Row>
                    ))}
                  </VStack>
                </Card>
              )}
            </>
          )}
        </VStack>
      </Screen>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <VStack gap="xs" style={{ flex: 1 }}>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
      <Txt variant="heading" tone="blue" numberOfLines={1}>
        {value}
      </Txt>
    </VStack>
  );
}

function Trend({ rows }: { rows: Array<{ date: string; revenue: number }> }) {
  const t = dict();
  const { c, space } = useTheme();

  if (!rows.length) return null;
  const peak = Math.max(...rows.map((r) => r.revenue), 0);

  return (
    <Card>
      <VStack gap="md">
        <Row justify="space-between">
          <Txt variant="label">{t.vaTrend}</Txt>
          <Txt variant="caption" tone="faint">
            {t.vaPeak} {money(peak)}
          </Txt>
        </Row>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 2,
            height: 96,
          }}
        >
          {rows.map((row) => (
            <View
              key={row.date}
              style={{
                flex: 1,
                // A day with sales must never be invisible, so a nonzero
                // revenue floors at 3px rather than rounding to nothing.
                height: peak > 0 ? Math.max(row.revenue > 0 ? 3 : 1, (row.revenue / peak) * 96) : 1,
                backgroundColor: row.revenue > 0 ? c.blue : c.line,
                borderRadius: 2,
              }}
            />
          ))}
        </View>

        <Row justify="space-between" style={{ marginTop: -space.xs }}>
          <Txt variant="caption" tone="faint">
            {rows[0]?.date}
          </Txt>
          <Txt variant="caption" tone="faint">
            {rows[rows.length - 1]?.date}
          </Txt>
        </Row>
      </VStack>
    </Card>
  );
}
