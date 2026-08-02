import type { VendorAnalytics, VendorOrder, VendorStore } from "@ovira/core";
import { myStore, vendorAnalytics, vendorOrders } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Rating } from "../../src/components/rating";
import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { SITE_LABEL } from "../../src/ovira";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

/** Orders the seller still owes work on. */
const OPEN_STATUSES = new Set(["Pending Payment", "Paid", "Processing"]);

/**
 * The seller's phone view.
 *
 * The top of the screen answers the two questions a seller standing in a
 * stockroom actually has — *what do I owe someone today* and *what am I
 * earning* — and everything else sits below it in a grid rather than competing
 * with them. The order of that matters more here than on a desk: a phone shows
 * one screenful, and this is the screenful.
 */
export default function VendorHome() {
  const { c, space } = useTheme();
  const router = useRouter();
  const access = useVendorAccess();
  const t = dict();

  const [store, setStore] = useState<VendorStore | null>(null);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [stats, setStats] = useState<VendorAnalytics | null>(null);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [shop, rows, analytics] = await Promise.all([
      myStore(),
      vendorOrders(50),
      vendorAnalytics(30),
    ]);
    setStore(shop);
    setOrders(rows);
    setStats(analytics);
    setState("ready");
  }, []);

  useEffect(() => {
    if (access.show) void load();
  }, [access.show, load]);

  if (access.show === false) {
    return (
      <>
        <Stack.Screen options={{ title: t.vendorArea }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? <Loading /> : <Empty icon="storefront-outline" title={t.notFound} />}
        </Screen>
      </>
    );
  }

  const pending = orders.filter((o) => OPEN_STATUSES.has(o.status));
  const totals = stats?.totals;

  return (
    <>
      <Stack.Screen options={{ title: t.vendorArea }} />
      <Screen scroll={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={c.blue}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        >
          {state === "loading" ? (
            <Loading />
          ) : (
            <>
              {access.status === "Suspended" && (
                <Card style={{ borderColor: c.coral }}>
                  <Txt variant="body" tone="coral">
                    {t.vendorSuspended}
                  </Txt>
                </Card>
              )}
              {access.status === "Pending" && (
                <Card>
                  <Txt variant="body" tone="muted">
                    {t.vendorPendingApproval}
                  </Txt>
                </Card>
              )}

              <Row justify="space-between">
                <VStack gap="xs" style={{ flex: 1 }}>
                  <Txt variant="title">{store?.vendor_name ?? t.vendorArea}</Txt>
                  {store?.trust_score != null && (
                    <Rating value={store.trust_score} showValue />
                  )}
                </VStack>
                {store?.trust_tier === "trusted" && (
                  <Ionicons name="shield-checkmark" size={24} color={c.mint} />
                )}
              </Row>

              {/* The one number a seller opens the app for. */}
              <Pressable onPress={() => router.push("/vendor/orders")}>
                <Card style={{ borderColor: pending.length ? c.blue : c.line }}>
                  <Row justify="space-between">
                    <VStack gap="xs">
                      <Txt variant="caption" tone="faint">
                        {t.vendorPending}
                      </Txt>
                      <Txt variant="display" tone={pending.length ? "blue" : "faint"}>
                        {num(pending.length)}
                      </Txt>
                    </VStack>
                    <Ionicons name="cube-outline" size={30} color={c.blue} />
                  </Row>
                </Card>
              </Pressable>

              {totals && (
                <VStack gap="md">
                  <Txt variant="heading">{fill(t.vendorPeriod, { n: num(30) })}</Txt>
                  <Card>
                    <VStack gap="md">
                      <Row justify="space-between">
                        <Txt variant="body" tone="muted">
                          {t.vendorGross}
                        </Txt>
                        <Txt variant="label">{money(totals.gross_sales)}</Txt>
                      </Row>
                      <Row justify="space-between">
                        <Txt variant="body" tone="muted">
                          {t.vendorCommission}
                        </Txt>
                        <Txt variant="label" tone="coral">
                          −{money(totals.commission)}
                        </Txt>
                      </Row>
                      <View style={{ height: 1, backgroundColor: c.line }} />
                      <Row justify="space-between">
                        <Txt variant="heading">{t.vendorNetEarnings}</Txt>
                        <Txt variant="title" tone="mint">
                          {money(totals.net_earnings)}
                        </Txt>
                      </Row>
                      <Row gap="lg">
                        <Txt variant="caption" tone="faint">
                          {num(totals.units_sold)} {t.vendorUnits}
                        </Txt>
                        <Txt variant="caption" tone="faint">
                          {num(totals.orders)} {t.vendorOrdersCount}
                        </Txt>
                      </Row>
                    </VStack>
                  </Card>
                </VStack>
              )}

              {orders.length > 0 && (
                <VStack gap="md">
                  <Row justify="space-between">
                    <Txt variant="heading">{t.vendorOrders}</Txt>
                    <Pressable onPress={() => router.push("/vendor/orders")}>
                      <Txt variant="label" tone="blue">
                        {t.seeAll}
                      </Txt>
                    </Pressable>
                  </Row>
                  {orders.slice(0, 3).map((order) => (
                    <Card key={order.name}>
                      <Row justify="space-between">
                        <VStack gap="xs" style={{ flex: 1 }}>
                          <Txt variant="label">{order.name}</Txt>
                          <Txt variant="caption" tone="faint">
                            {formatDate(order.creation)}
                          </Txt>
                        </VStack>
                        <Txt variant="heading" tone="blue">
                          {money(order.vendor_total)}
                        </Txt>
                      </Row>
                    </Card>
                  ))}
                </VStack>
              )}

              <VendorNav />

              {/* The operator console is still the web's — but the seller's own
                  job is now here, so this is a link out rather than an
                  admission. */}
              <Pressable
                onPress={() => void Linking.openURL(`https://${SITE_LABEL}/shop/vendor`)}
                style={{ alignItems: "center", paddingVertical: space.md }}
              >
                <Row gap="xs">
                  <Ionicons name="open-outline" size={15} color={c.blue} />
                  <Txt variant="label" tone="blue">
                    {t.vendorFullConsole}
                  </Txt>
                </Row>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}

/**
 * The rest of the seller's job.
 *
 * A grid rather than a list of links: these are eleven destinations, and a
 * seller reaching for "coupons" should find it by shape and position, not by
 * reading eleven rows of Arabic every time.
 */
function VendorNav() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();

  const items: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; to: string }> = [
    { icon: "cube-outline", label: t.vpTitle, to: "/vendor/products" },
    { icon: "car-outline", label: t.vsTitle, to: "/vendor/shipments" },
    { icon: "chatbubble-ellipses-outline", label: t.vmTitle, to: "/vendor/messages" },
    { icon: "pricetag-outline", label: t.vcTitle, to: "/vendor/coupons" },
    { icon: "stats-chart-outline", label: t.vaTitle, to: "/vendor/analytics" },
    { icon: "bulb-outline", label: t.viwTitle, to: "/vendor/insights" },
    { icon: "document-text-outline", label: t.vrTitle, to: "/vendor/reports" },
    { icon: "swap-vertical-outline", label: t.viTitle, to: "/vendor/products/import" },
    { icon: "settings-outline", label: t.vstTitle, to: "/vendor/settings" },
  ];

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
      {items.map((item) => (
        <Pressable
          key={item.to}
          onPress={() => router.push(item.to as never)}
          style={{
            width: "47%",
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: radius.lg,
            paddingVertical: space.lg,
            paddingHorizontal: space.md,
            alignItems: "center",
            gap: space.sm,
          }}
        >
          <Ionicons name={item.icon} size={22} color={c.blue} />
          <Txt variant="caption" numberOfLines={1} style={{ textAlign: "center" }}>
            {item.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
