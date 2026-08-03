import { myProductFunnel, type FunnelRow } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

const WINDOWS = [7, 30, 90] as const;

/** Colour by how much the seller should worry, not by the metric. */
const TONES: Record<string, "blue" | "mint" | "coral"> = {
  healthy: "mint",
  no_data: "blue",
  unpublished: "coral",
  unseen: "coral",
  not_tempting: "coral",
  abandoned: "coral",
};

/**
 * Views → basket → sold, per product.
 *
 * The server sorts by the **gap** between interest and sales, and that ordering
 * is the whole value: a product nobody looks at needs marketing, but a product
 * plenty look at and nobody buys has something wrong with its price, its photo
 * or its description — and that is fixable this afternoon.
 *
 * The diagnosis is the server's word, not a threshold re-derived here. Two
 * clients disagreeing about when a product is "abandoned" would be worse than
 * either answer.
 */
export default function VendorFunnelScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const access = useVendorAccess();

  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    setState("loading");
    const found = await myProductFunnel(days, 50);
    setRows(found.rows);
    setState("ready");
  }, [access, days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vfTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="funnel-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vfTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Txt variant="body" tone="muted">
            {t.vfIntro}
          </Txt>

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
          ) : rows.length === 0 ? (
            <Empty icon="funnel-outline" title={t.vfEmpty} body={t.vfEmptyBody} />
          ) : (
            <VStack gap="md">
              {rows.map((row) => (
                <Card key={row.product}>
                  <VStack gap="md">
                    <Row justify="space-between" align="flex-start">
                      <VStack gap="xs" style={{ flex: 1 }}>
                        <Txt variant="label" numberOfLines={2}>
                          {row.title}
                        </Txt>
                        <Txt variant="caption" tone="faint">
                          {money(row.price)} · {t.inStockShort} {num(row.stock_qty)}
                        </Txt>
                      </VStack>
                      <Pill
                        label={t.vfDiagnosis[row.diagnosis] ?? row.diagnosis}
                        tone={TONES[row.diagnosis] ?? "blue"}
                      />
                    </Row>

                    <Row justify="space-between">
                      <Step icon="eye-outline" label={t.vfViews} value={num(row.views)} />
                      <Arrow rate={row.view_to_cart} />
                      <Step icon="cart-outline" label={t.vfCarted} value={num(row.cart_adds)} />
                      <Arrow rate={row.cart_to_sale} />
                      <Step icon="bag-check-outline" label={t.vfSold} value={num(row.sold)} />
                    </Row>
                  </VStack>
                </Card>
              ))}
            </VStack>
          )}
        </VStack>
      </Screen>
    </>
  );
}

function Step({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { c } = useTheme();
  return (
    <VStack gap="xs" style={{ alignItems: "center" }}>
      <Ionicons name={icon} size={16} color={c.ink400} />
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" tone="faint">
        {label}
      </Txt>
    </VStack>
  );
}

/** The conversion between two steps — where the shoppers went. */
function Arrow({ rate }: { rate: number }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      {/* Points the way the funnel runs, which under RTL is leftwards. */}
      <Ionicons name="arrow-back" size={14} color={c.line} />
      <Txt variant="caption" tone={rate > 0 ? "muted" : "faint"}>
        {num(rate, { decimals: 1 })}%
      </Txt>
    </View>
  );
}
