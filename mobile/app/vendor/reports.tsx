import { exportMyOrdersCsv, reportDate, vendorReport, type VendorReport } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { statusLabel } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

const RANGES = [30, 90, 365] as const;

/**
 * The seller's statement over a window they choose.
 *
 * Gross, commission and net are shown together and in that order, because the
 * number that matters is the third one and it is only meaningful next to the
 * two it came from. Low stock rides along: it is the one thing in a report
 * that is still actionable today.
 */
export default function VendorReportsScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const access = useVendorAccess();

  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [report, setReport] = useState<VendorReport | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    setState("loading");
    setReport(await vendorReport(reportDate(days), reportDate(0)));
    setState("ready");
  }, [access, days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vrTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="document-text-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vrTitle }} />
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
          ) : !report ? (
            <Empty icon="document-text-outline" title={t.loadFailed} onRetry={() => void load()} />
          ) : (
            <>
              <Card>
                <VStack gap="md">
                  <Row justify="space-between">
                    <Txt variant="body" tone="muted">
                      {t.vendorGross}
                    </Txt>
                    <Txt variant="label">{money(report.summary.gross)}</Txt>
                  </Row>
                  <Row justify="space-between">
                    <Txt variant="body" tone="muted">
                      {t.vendorCommission}
                    </Txt>
                    <Txt variant="label" tone="coral">
                      −{money(report.summary.commission)}
                    </Txt>
                  </Row>
                  <View style={{ height: 1, backgroundColor: c.line }} />
                  <Row justify="space-between">
                    <Txt variant="heading">{t.vendorNetEarnings}</Txt>
                    <Txt variant="title" tone="mint">
                      {money(report.summary.net)}
                    </Txt>
                  </Row>
                  <Row gap="lg" style={{ flexWrap: "wrap" }}>
                    <Txt variant="caption" tone="faint">
                      {num(report.summary.orders)} {t.vendorOrdersCount}
                    </Txt>
                    <Txt variant="caption" tone="faint">
                      {num(report.summary.units)} {t.vendorUnits}
                    </Txt>
                    <Txt variant="caption" tone="faint">
                      {t.vaAov} {money(report.summary.aov)}
                    </Txt>
                  </Row>
                </VStack>
              </Card>

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
                    <Txt variant="label">{t.vaTopProducts}</Txt>
                    {report.top_products.map((row, index) => (
                      <Row key={`${row.title}-${index}`} justify="space-between" align="flex-start">
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

              {/* The only part of a report a seller can act on today. */}
              {report.low_stock.length > 0 && (
                <Card style={{ borderColor: c.coral }}>
                  <VStack gap="md">
                    <Txt variant="label" tone="coral">
                      {t.vrLowStock}
                    </Txt>
                    {report.low_stock.map((row, index) => (
                      <Row key={`${row.title}-${index}`} justify="space-between">
                        <Txt variant="body" tone="muted" style={{ flex: 1 }} numberOfLines={2}>
                          {row.title}
                        </Txt>
                        <Txt variant="label" tone="coral">
                          {num(row.stock_qty)}
                        </Txt>
                      </Row>
                    ))}
                  </VStack>
                </Card>
              )}

              {/* The seller's own order rows, for a spreadsheet or an
                  accountant. Copied rather than downloaded: a phone has
                  nowhere useful to put a .csv, and the clipboard reaches
                  every app that would open one. */}
              <Pressable
                onPress={async () => {
                  const { csv, count } = await exportMyOrdersCsv();
                  if (!csv) return;
                  await Clipboard.setStringAsync(csv);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  void count;
                }}
                style={{ alignItems: "center" }}
              >
                <Row gap="xs">
                  <Ionicons name="copy-outline" size={15} color={c.blue} />
                  <Txt variant="label" tone="blue">
                    {copied ? t.viCopied : t.vrExport}
                  </Txt>
                </Row>
              </Pressable>

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
