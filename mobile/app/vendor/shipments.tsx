import {
  createMyShipment,
  myOrderShipments,
  updateMyShipment,
  vendorOrders,
  vendorShipmentStatuses,
  listVendorCarriers,
  markDelivered,
  SHIPMENT_STATUSES,
  type Shipment,
  type ShipmentStatus,
  type VendorOrder,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { ChoiceRow, Field, PrimaryButton } from "../../src/components/form";
import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, formatDate, money, num } from "../../src/i18n";
import { shipmentStatusLabel, shipmentStatusTone } from "../../src/shipment-status";
import { useTheme } from "../../src/theme-context";
import { useVendorAccess } from "../../src/vendor-access";

type Filter = "todo" | "shipped" | "all";

/**
 * Fulfilment, from the seller's side.
 *
 * The default filter is **what still needs a shipment**, because that is the
 * only question this screen is opened to answer while standing over a pile of
 * boxes. "Everything ever shipped" is a report, and lives one tap away.
 */
export default function VendorShipmentsScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();
  const access = useVendorAccess();

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [carrierNames, setCarrierNames] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("todo");
  const [state, setState] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    if (!access.show) {
      setState(access.reason === "loading" ? "loading" : "ready");
      return;
    }
    const [rows, shipped, couriers] = await Promise.all([
      vendorOrders(100),
      vendorShipmentStatuses(),
      listVendorCarriers(),
    ]);
    setOrders(rows);
    setStatuses(shipped);
    setCarrierNames(couriers.map((r) => r.carrier_name));
    setState("ready");
  }, [access]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!access.show) {
    return (
      <>
        <Stack.Screen options={{ title: t.vsTitle }} />
        <Screen scroll={false}>
          {access.reason === "loading" ? (
            <Loading />
          ) : (
            <Empty icon="car-outline" title={t.vendorNotSeller} />
          )}
        </Screen>
      </>
    );
  }

  // Cancelled orders are nobody's fulfilment problem, and leaving them in the
  // "needs shipping" pile is how a seller stops trusting the count.
  const live = orders.filter((o) => o.status !== "Cancelled");
  const todo = live.filter((o) => !statuses[o.name]);
  const shipped = live.filter((o) => statuses[o.name]);
  const visible = filter === "todo" ? todo : filter === "shipped" ? shipped : live;

  const tabs: Array<{ key: Filter; label: string; count: number }> = [
    { key: "todo", label: t.vsTodo, count: todo.length },
    { key: "shipped", label: t.vsShipped, count: shipped.length },
    { key: "all", label: t.vsAll, count: live.length },
  ];

  return (
    <>
      <Stack.Screen options={{ title: t.vsTitle }} />
      <Screen>
        <VStack gap="lg" style={{ paddingBottom: space.xxl }}>
          <Row gap="sm">
            {tabs.map((tab) => {
              const on = filter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
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
                    {tab.label} ({num(tab.count)})
                  </Txt>
                </Pressable>
              );
            })}
          </Row>

          {state === "loading" ? (
            <Loading />
          ) : visible.length === 0 ? (
            <Empty
              icon="checkmark-circle-outline"
              title={filter === "todo" ? t.vsAllDone : t.vsNone}
            />
          ) : (
            <VStack gap="md">
              {visible.map((order) => (
                <ShipmentCard
                  key={order.name}
                  order={order}
                  shippedStatus={statuses[order.name]}
                  carriers={carrierNames}
                  onChanged={load}
                />
              ))}
            </VStack>
          )}
        </VStack>
      </Screen>
    </>
  );
}

function ShipmentCard({
  order,
  shippedStatus,
  carriers,
  onChanged,
}: {
  order: VendorOrder;
  shippedStatus?: string;
  carriers: string[];
  onChanged: () => Promise<void>;
}) {
  const t = dict();
  const { c, space } = useTheme();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expand = async () => {
    const next = !open;
    setOpen(next);
    if (next && !shipments.length) {
      const { shipments: found, preferred_carrier } = await myOrderShipments(order.name);
      setShipments(found);
      // The buyer's requested courier, offered as a default the seller can
      // overrule — it is a preference, not a booking.
      if (preferred_carrier && !carrier) setCarrier(preferred_carrier);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await createMyShipment(order.name, {
        carrier: carrier.trim() || undefined,
        tracking_number: tracking.trim() || undefined,
      });
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const handOver = async () => {
    setBusy(true);
    setError(null);
    try {
      await markDelivered(order.name);
      setOpen(false);
      await onChanged();
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const advance = async (shipment: string, status: ShipmentStatus) => {
    setBusy(true);
    setError(null);
    try {
      await updateMyShipment(shipment, { status });
      const { shipments: found } = await myOrderShipments(order.name);
      setShipments(found);
      await onChanged();
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <VStack gap="md">
        <Pressable onPress={() => void expand()}>
          <Row justify="space-between" align="flex-start">
            <VStack gap="xs" style={{ flex: 1 }}>
              <Txt variant="label">{order.name}</Txt>
              {/* Not the governorate: `vendor.my_orders` deliberately returns
                  only this vendor's slice, and the delivery address is not in
                  it. It is on the waybill, which is where it is needed. */}
              <Txt variant="caption" tone="faint">
                {formatDate(order.creation)} · {order.customer_name || "—"}
              </Txt>
            </VStack>
            <VStack gap="xs" style={{ alignItems: "flex-end" }}>
              <Txt variant="label" tone="blue">
                {money(order.vendor_total)}
              </Txt>
              {shippedStatus ? (
                <Pill
                  label={shipmentStatusLabel(shippedStatus)}
                  tone={shipmentStatusTone(shippedStatus)}
                />
              ) : (
                <Pill label={t.vsNeedsShipping} tone="coral" />
              )}
            </VStack>
          </Row>
        </Pressable>

        {open && (
          <VStack gap="md">
            <View style={{ height: 1, backgroundColor: c.line }} />

            {shipments.length === 0 ? (
              <>
                {/* A directory the operator maintains, when there is one.
                    Free text otherwise, because a seller using their own
                    courier must still be able to name them. */}
                {carriers.length > 0 ? (
                  <VStack gap="sm">
                    <Txt variant="caption" tone="faint">
                      {t.vendorCarrier}
                    </Txt>
                    <ChoiceRow
                      options={carriers.map((carrierName) => ({
                        value: carrierName,
                        label: carrierName,
                      }))}
                      value={carrier || null}
                      onChange={setCarrier}
                    />
                  </VStack>
                ) : (
                  <Field
                    label={t.vendorCarrier}
                    value={carrier}
                    onChange={setCarrier}
                    placeholder={t.vsCarrierHint}
                  />
                )}
                <Field
                  label={t.vendorTracking}
                  value={tracking}
                  onChange={setTracking}
                  placeholder={t.vpOptional}
                />
                <PrimaryButton
                  label={t.vendorShip}
                  icon="car-outline"
                  busy={busy}
                  onPress={() => void create()}
                />
                {/* Not every parcel goes through a courier. Without this a
                    seller who handed it over themselves could not close the
                    order at all, and the buyer saw "being prepared" for
                    something already in their hands. */}
                <Pressable onPress={() => void handOver()} style={{ alignItems: "center" }}>
                  <Row gap="xs">
                    <Ionicons name="checkmark-circle-outline" size={15} color={c.mint} />
                    <Txt variant="label" tone="mint">
                      {t.vsHandedOver}
                    </Txt>
                  </Row>
                </Pressable>
              </>
            ) : (
              shipments.map((shipment) => (
                <VStack key={shipment.name} gap="sm">
                  <Row justify="space-between">
                    <Txt variant="caption" tone="muted">
                      {shipment.carrier || shipment.provider || t.vendorCarrier}
                    </Txt>
                    <Pill
                      label={shipmentStatusLabel(shipment.status)}
                      tone={shipmentStatusTone(shipment.status)}
                    />
                  </Row>
                  {!!shipment.tracking_number && (
                    <Txt variant="caption" tone="faint">
                      {shipment.tracking_number}
                    </Txt>
                  )}

                  <Row gap="sm" style={{ flexWrap: "wrap" }}>
                    {SHIPMENT_STATUSES.filter((s) => s !== shipment.status).map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => void advance(shipment.name, status)}
                        disabled={busy}
                        style={{
                          borderWidth: 1,
                          borderColor: c.line,
                          borderRadius: 999,
                          paddingHorizontal: space.md,
                          paddingVertical: space.xs,
                        }}
                      >
                        <Txt variant="caption" tone="muted">
                          {shipmentStatusLabel(status)}
                        </Txt>
                      </Pressable>
                    ))}
                  </Row>

                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/vendor/label/[shipment]",
                        params: { shipment: shipment.name },
                      })
                    }
                  >
                    <Row gap="xs">
                      <Ionicons name="pricetag-outline" size={15} color={c.blue} />
                      <Txt variant="caption" tone="blue">
                        {t.vlTitle}
                      </Txt>
                    </Row>
                  </Pressable>
                </VStack>
              ))
            )}

            {!!error && (
              <Txt variant="caption" tone="coral">
                {error}
              </Txt>
            )}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
