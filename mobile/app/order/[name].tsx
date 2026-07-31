import type { Order, Shipment } from "@ovira/core";
import { cancelOrder, getOrder, getProduct, orderTracking, reorderItems } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";

import { useCart } from "../../src/cart-store";
import { PrimaryButton } from "../../src/components/form";
import { OrderStatusPill, PaymentPill, statusLabel } from "../../src/components/order-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";

export default function OrderScreen() {
  const { name, placed } = useLocalSearchParams<{ name: string; placed?: string }>();
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const addToCart = useCart((s) => s.add);
  const t = dict();

  const [order, setOrder] = useState<Order | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const key = String(name ?? "");
    const found = await getOrder(key);
    if (!found) {
      setState("missing");
      return;
    }
    setOrder(found);
    setState("ready");
    setShipments(await orderTracking(key));
  }, [name]);

  useEffect(() => {
    void load();
  }, [load]);

  const doCancel = useCallback(() => {
    Alert.alert(t.cancelOrder, t.cancelConfirm, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.cancelOrder,
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await cancelOrder(String(name));
            await load();
          } catch (err) {
            Alert.alert(t.loadFailed, err instanceof Error ? err.message : "");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [name, load, t]);

  /**
   * Re-order: the server says which of these items are still buyable (it
   * returns only slug and quantity), and the catalogue is then asked for each
   * one's **current** price and stock.
   *
   * Reusing the price from the old order would be the wrong number and the
   * wrong principle — prices move, and the cart is never the authority on what
   * something costs.
   */
  const doReorder = useCallback(async () => {
    setBusy(true);
    try {
      const wanted = await reorderItems(String(name));
      const products = await Promise.all(wanted.map((w) => getProduct(w.slug)));
      let added = 0;
      products.forEach((product, i) => {
        const want = wanted[i];
        if (!product || !want) return;
        addToCart({
          slug: product.slug,
          title: product.title,
          price: product.price,
          qty: want.qty,
          image: product.image,
          vendor_name: product.vendor_name,
          stock_qty: product.stock_qty,
        });
        added += 1;
      });
      if (!added) {
        Alert.alert(t.reorder, t.reorderNothing);
        return;
      }
      router.push("/cart");
    } catch (err) {
      Alert.alert(t.loadFailed, err instanceof Error ? err.message : "");
    } finally {
      setBusy(false);
    }
  }, [name, addToCart, router, t.loadFailed, t.reorder, t.reorderNothing]);

  if (state === "loading") {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }

  if (state === "missing" || !order) {
    return (
      <>
        <Stack.Screen options={{ title: t.notFound }} />
        <Screen scroll={false}>
          <Empty icon="receipt-outline" title={t.notFound} />
        </Screen>
      </>
    );
  }

  const cancellable = order.status === "Pending Payment" || order.status === "Paid";

  return (
    <>
      <Stack.Screen options={{ title: order.name }} />
      <Screen>
        <VStack gap="lg">
          {placed === "1" && (
            // Shown once, straight after checkout. The order number is the thing
            // a shopper writes down or screenshots, so it is the largest text on
            // the screen at the moment they most need it.
            <Card style={{ borderColor: c.mint }}>
              <VStack gap="sm" style={{ alignItems: "center" }}>
                <Ionicons name="checkmark-circle" size={40} color={c.mint} />
                <Txt variant="heading">{t.orderPlaced}</Txt>
                <Txt variant="caption" tone="faint">
                  {t.orderNumber}
                </Txt>
                <Txt variant="title">{order.name}</Txt>
              </VStack>
            </Card>
          )}

          <Row justify="space-between">
            <OrderStatusPill status={order.status} />
            <PaymentPill status={order.payment_status} />
          </Row>

          <Row justify="space-between">
            <Txt variant="body" tone="muted">
              {t.orderDate}
            </Txt>
            <Txt variant="label">{formatDate(order.creation)}</Txt>
          </Row>

          {!!order.items?.length && (
            <VStack gap="md">
              {order.items.map((item, i) => (
                <Card key={`${item.title}-${i}`}>
                  <Row gap="md" align="flex-start">
                    <Image
                      source={item.image}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.md,
                        backgroundColor: c.blue050,
                      }}
                      contentFit="cover"
                    />
                    <VStack gap="xs" style={{ flex: 1 }}>
                      <Txt variant="label" numberOfLines={2}>
                        {item.title}
                      </Txt>
                      <Row justify="space-between">
                        <Txt variant="caption" tone="faint">
                          {num(item.qty)} × {money(item.rate)}
                        </Txt>
                        <Txt variant="label" tone="blue">
                          {money(item.amount)}
                        </Txt>
                      </Row>
                    </VStack>
                  </Row>
                </Card>
              ))}
            </VStack>
          )}

          <Card>
            <VStack gap="sm">
              <Line label={t.subtotal} value={money(order.subtotal)} />
              {!!order.discount_amount && order.discount_amount > 0 && (
                <Line
                  label={order.coupon_code ? `${t.discountLabel} · ${order.coupon_code}` : t.discountLabel}
                  value={`−${money(order.discount_amount)}`}
                  tone="mint"
                />
              )}
              {!!order.tax_amount && (
                // Whether this is already inside the total or sits on top of it
                // is the difference the whole tax investigation turned on, so it
                // is stated on the line rather than left to be inferred.
                <Line
                  label={`${t.tax}${order.tax_rate ? ` ${num(order.tax_rate)}%` : ""} · ${
                    order.tax_inclusive ? t.taxInclusiveShort : t.taxExclusiveShort
                  }`}
                  value={money(order.tax_amount)}
                  tone={order.tax_inclusive ? "faint" : "ink"}
                />
              )}
              <Line label={t.shipping} value={money(order.shipping_amount)} />
              {!!order.wallet_applied && order.wallet_applied > 0 && (
                <Line label={t.wallet} value={`−${money(order.wallet_applied)}`} tone="mint" />
              )}
              <View style={{ height: 1, backgroundColor: c.line, marginVertical: space.xs }} />
              <Row justify="space-between">
                <Txt variant="heading">{t.total}</Txt>
                <Txt variant="title" tone="blue">
                  {money(order.total)}
                </Txt>
              </Row>
            </VStack>
          </Card>

          {!!order.shipping_address && (
            <Card>
              <VStack gap="xs">
                <Txt variant="caption" tone="faint">
                  {t.deliveryDetails}
                </Txt>
                <Txt variant="label">{order.customer_name}</Txt>
                <Txt variant="body" tone="muted">
                  {order.governorate} · {order.shipping_address}
                </Txt>
                {!!order.shipping_eta_min && (
                  <Txt variant="caption" tone="faint">
                    {fill(t.etaDays, {
                      min: num(order.shipping_eta_min),
                      max: num(order.shipping_eta_max ?? order.shipping_eta_min),
                    })}
                  </Txt>
                )}
              </VStack>
            </Card>
          )}

          <VStack gap="md">
            <Txt variant="heading">{t.tracking}</Txt>
            {shipments.length === 0 ? (
              <Txt variant="body" tone="faint">
                {t.noTracking}
              </Txt>
            ) : (
              shipments.map((shipment) => (
                <Card key={shipment.name}>
                  <VStack gap="sm">
                    <Row justify="space-between">
                      <Txt variant="label">{shipment.carrier || t.tracking}</Txt>
                      <Txt variant="caption" tone="blue">
                        {statusLabel(shipment.status)}
                      </Txt>
                    </Row>
                    {!!shipment.tracking_number && (
                      <Txt variant="caption" tone="faint">
                        {shipment.tracking_number}
                      </Txt>
                    )}
                    {!!shipment.tracking_url && (
                      <Pressable onPress={() => void Linking.openURL(shipment.tracking_url!)}>
                        <Txt variant="label" tone="blue">
                          {t.tracking} ↗
                        </Txt>
                      </Pressable>
                    )}
                    {shipment.events?.map((event, i) => (
                      <Row key={i} gap="sm" align="flex-start">
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: c.blue,
                            marginTop: 8,
                          }}
                        />
                        <VStack gap="xs" style={{ flex: 1 }}>
                          <Txt variant="caption">{statusLabel(event.status)}</Txt>
                          {!!event.note && (
                            <Txt variant="caption" tone="faint">
                              {event.note}
                            </Txt>
                          )}
                        </VStack>
                      </Row>
                    ))}
                  </VStack>
                </Card>
              ))
            )}
          </VStack>

          <VStack gap="md">
            <PrimaryButton
              label={t.reorder}
              icon="repeat-outline"
              onPress={() => void doReorder()}
              busy={busy}
            />
            {cancellable && (
              <Pressable onPress={doCancel} disabled={busy} style={{ alignItems: "center" }}>
                <Txt variant="label" tone="coral">
                  {t.cancelOrder}
                </Txt>
              </Pressable>
            )}
          </VStack>
        </VStack>
      </Screen>
    </>
  );
}

function Line({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "faint" | "mint";
}) {
  return (
    <Row justify="space-between">
      <Txt variant="body" tone="muted" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="label" tone={tone}>
        {value}
      </Txt>
    </Row>
  );
}
