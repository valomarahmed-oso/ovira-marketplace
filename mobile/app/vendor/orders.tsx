import type { VendorOrder } from "@ovira/core";
import { listCarriers, shipVendorOrder, vendorOrders, vendorShipmentStatuses } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { ChoiceRow, Field, PrimaryButton } from "../../src/components/form";
import { OrderStatusPill } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

const OPEN_STATUSES = new Set(["Pending Payment", "Paid", "Processing"]);

export default function VendorOrdersScreen() {
  const { c, space } = useTheme();
  const access = useVendorAccess();
  const t = dict();

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [shipments, setShipments] = useState<Record<string, string>>({});
  const [carriers, setCarriers] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [shipping, setShipping] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rows, statuses] = await Promise.all([vendorOrders(100), vendorShipmentStatuses()]);
    setOrders(rows);
    setShipments(statuses);
    setState("ready");
  }, []);

  useEffect(() => {
    if (!access.show) return;
    void load();
    void listCarriers().then((rows) => setCarriers(rows.map((r) => r.carrier_name)));
  }, [access.show, load]);

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vendorOrders }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? <Loading /> : <Empty icon="cube-outline" title={t.notFound} />}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.vendorOrders }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Screen scroll={false}>
          {state === "loading" ? (
            <Loading />
          ) : orders.length === 0 ? (
            <Empty icon="cube-outline" title={t.vendorNoOrders} body={t.vendorNoOrdersBody} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: space.md, paddingBottom: space.xxl }}
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
              {orders.map((order) => {
                const shipped = shipments[order.name];
                const needsWork = OPEN_STATUSES.has(order.status) && !shipped;
                return (
                  <Card key={order.name} style={needsWork ? { borderColor: c.blue } : undefined}>
                    <VStack gap="sm">
                      <Row justify="space-between">
                        <Txt variant="label">{order.name}</Txt>
                        <OrderStatusPill status={order.status} />
                      </Row>

                      <Row justify="space-between">
                        <Txt variant="caption" tone="faint">
                          {order.customer_name} · {formatDate(order.creation)}
                        </Txt>
                      </Row>

                      <Row justify="space-between">
                        {/* Labelled "your share" on purpose. A seller shown the
                            full basket total of an order containing three other
                            shops' goods will believe they are owed it. */}
                        <Txt variant="caption" tone="faint">
                          {t.vendorMyShare} · {num(order.item_count)}
                        </Txt>
                        <Txt variant="heading" tone="blue">
                          {money(order.vendor_total)}
                        </Txt>
                      </Row>

                      {shipped ? (
                        <Row gap="xs">
                          <Ionicons name="checkmark-circle" size={14} color={c.mint} />
                          <Pill label={t.vendorShipped} tone="mint" />
                        </Row>
                      ) : shipping === order.name ? (
                        <ShipForm
                          carriers={carriers}
                          onCancel={() => setShipping(null)}
                          onDone={async () => {
                            setShipping(null);
                            await load();
                          }}
                          order={order.name}
                        />
                      ) : (
                        OPEN_STATUSES.has(order.status) && (
                          <Pressable
                            onPress={() => setShipping(order.name)}
                            style={{ paddingTop: space.xs }}
                          >
                            <Row gap="xs">
                              <Ionicons name="send-outline" size={15} color={c.blue} />
                              <Txt variant="label" tone="blue">
                                {t.vendorShip}
                              </Txt>
                            </Row>
                          </Pressable>
                        )
                      )}
                    </VStack>
                  </Card>
                );
              })}
            </ScrollView>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}

/**
 * Recording a shipment, in the two fields a seller actually has to hand.
 *
 * Leaving the courier blank is allowed: the server then uses whichever one the
 * *buyer* asked for, which is a better default than nothing and better than
 * forcing a choice the seller may not have made yet.
 */
function ShipForm({
  order,
  carriers,
  onCancel,
  onDone,
}: {
  order: string;
  carriers: string[];
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { space } = useTheme();
  const t = dict();

  const [carrier, setCarrier] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await shipVendorOrder({
        order,
        carrier: carrier ?? undefined,
        trackingNumber: tracking.trim() || undefined,
      });
      await onDone();
    } catch (err) {
      Alert.alert(t.vendorShip, err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap="md" style={{ paddingTop: space.sm }}>
      {carriers.length > 0 && (
        <VStack gap="xs">
          <Txt variant="caption" tone="muted">
            {t.vendorCarrier}
          </Txt>
          <ChoiceRow
            options={carriers.map((name) => ({ value: name, label: name }))}
            value={carrier}
            onChange={setCarrier}
          />
        </VStack>
      )}
      <Field label={t.vendorTracking} value={tracking} onChange={setTracking} />
      <PrimaryButton label={t.vendorShip} onPress={() => void submit()} busy={busy} />
      <Pressable onPress={onCancel} style={{ alignItems: "center" }}>
        <Txt variant="caption" tone="faint">
          {t.cancel}
        </Txt>
      </Pressable>
      <View />
    </VStack>
  );
}
