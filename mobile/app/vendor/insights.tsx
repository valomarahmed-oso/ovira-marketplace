import { myBenchmarks, type Benchmarks, type Comparison } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

/**
 * This seller against the sellers they actually compete with.
 *
 * The direction of "good" is **not** decided here. The server sends a
 * `standing` word per metric, because return rate is the one where lower wins
 * and a client re-deriving that would eventually congratulate someone on a
 * rising return rate.
 *
 * When there are too few peers the server refuses instead of inventing a
 * median, and this screen says so — a benchmark against two stores is worse
 * than none, because it looks like information.
 */
export default function VendorInsightsScreen() {
  const t = dict();
  const { space } = useTheme();
  const access = useVendorAccess();

  const [data, setData] = useState<Benchmarks | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    setData(await myBenchmarks(30));
    setState("ready");
  }, [access]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.viwTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="bulb-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.viwTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          {state === "loading" ? (
            <Loading />
          ) : !data ? (
            <Empty icon="bulb-outline" title={t.loadFailed} onRetry={() => void load()} />
          ) : !data.available ? (
            <Empty
              icon="people-outline"
              title={t.viwNoPeers}
              body={fill(t.viwNoPeersBody, {
                have: num(data.peer_count),
                need: num(data.min_peers),
              })}
            />
          ) : (
            <>
              <Txt variant="body" tone="muted">
                {fill(t.viwIntro, { n: num(data.peer_count) })}
              </Txt>

              {data.comparisons.map((row) => (
                <ComparisonCard key={row.metric} row={row} />
              ))}

              <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
                {formatDate(data.from_date)} — {formatDate(data.to_date)}
              </Txt>
            </>
          )}
        </VStack>
      </Screen>
    </>
  );
}

/** Money metrics format as money; a rate is a percentage; a count is a count. */
function formatMetric(metric: string, value: number | null): string {
  if (value == null) return "—";
  if (metric === "gross" || metric === "aov") return money(value);
  if (metric === "return_rate") return `${num(value * 100, { decimals: 1 })}%`;
  if (metric === "trust_score") return num(value, { decimals: 1 });
  return num(value);
}

function ComparisonCard({ row }: { row: Comparison }) {
  const t = dict();
  const { c, space, radius } = useTheme();

  const tone =
    row.standing === "ahead" ? c.mint : row.standing === "behind" ? c.coral : c.ink400;
  const icon =
    row.standing === "ahead"
      ? "trending-up"
      : row.standing === "behind"
        ? "trending-down"
        : "remove";

  return (
    <Card>
      <VStack gap="md">
        <Row justify="space-between">
          <Txt variant="label">{t.viwMetrics[row.metric] ?? row.metric}</Txt>
          <Row gap="xs">
            <Ionicons name={icon} size={15} color={tone} />
            <Txt variant="caption" style={{ color: tone }}>
              {t.viwStanding[row.standing] ?? row.standing}
            </Txt>
          </Row>
        </Row>

        <Row justify="space-between">
          <VStack gap="xs">
            <Txt variant="caption" tone="faint">
              {t.viwMine}
            </Txt>
            <Txt variant="heading" tone="blue">
              {formatMetric(row.metric, row.mine)}
            </Txt>
          </VStack>
          <VStack gap="xs" style={{ alignItems: "flex-start" }}>
            <Txt variant="caption" tone="faint">
              {t.viwPeerMedian}
            </Txt>
            <Txt variant="heading" tone="muted">
              {formatMetric(row.metric, row.peer_median)}
            </Txt>
          </VStack>
        </Row>

        {row.percentile != null && (
          <VStack gap="xs">
            {/* The bar is filled to the percentile, and it is drawn in the
                metric's own direction — on return rate a full bar is bad, so
                the colour comes from `standing`, never from the length. */}
            <View
              style={{
                height: 6,
                backgroundColor: c.line,
                borderRadius: radius.pill,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.max(2, Math.min(100, row.percentile))}%`,
                  height: "100%",
                  backgroundColor: tone,
                }}
              />
            </View>
            <Txt variant="caption" tone="faint">
              {fill(t.viwPercentile, { n: num(Math.round(row.percentile)) })}
            </Txt>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
