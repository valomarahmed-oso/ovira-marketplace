import type { Order, ReturnReason, ReturnRequest, Shipment } from "@ovira/core";
import {
  cancelOrder,
  getOrder,
  getProduct,
  orderReturn,
  orderTracking,
  orderVendors,
  reorderItems,
  requestReturn,
  RETURN_REASONS,
  trackOrder,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";

import { useCart } from "../../src/cart-store";
import { Field, PrimaryButton } from "../../src/components/form";
import { OrderStatusPill, PaymentPill, statusLabel } from "../../src/components/order-status";
import { returnReasonLabel, ReturnStatusPill } from "../../src/components/return-status";
import { Empty, Loading } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { useGuestOrders } from "../../src/guest-orders";
import { dict, fill, formatDate, money, num } from "../../src/i18n";
import { useSession } from "../../src/session";
import { useTheme } from "../../src/theme-context";

export default function OrderScreen() {
  const { name, placed } = useLocalSearchParams<{ name: string; placed?: string }>();
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const addToCart = useCart((s) => s.add);
  const token = useGuestOrders((s) => s.tokens[String(name ?? "")]);
  const user = useSession((s) => s.user);
  const t = dict();

  const [order, setOrder] = useState<Order | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);

  /**
   * Two ways to read an order, because there are two kinds of shopper.
   *
   * A signed-in buyer is recognised by their session. A guest is not — and
   * `get_order` rightly refuses them, or any order would be readable by anyone
   * who could guess an id. Their proof is the capability token the checkout
   * handed back, which `track_order` accepts. Without this fallback the app
   * told a guest their order did not exist one second after they placed it.
   */
  const load = useCallback(async () => {
    const key = String(name ?? "");
    const found = (await getOrder(key)) ?? (token ? await trackOrder({ name: key, token }) : null);
    if (!found) {
      setState("missing");
      return;
    }
    setOrder(found);
    setState("ready");
    setShipments(await orderTracking(key));
  }, [name, token]);

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

          {/* Cancelling and re-ordering both need a session that owns the order.
              For a guest they would fail every time, so they are not offered —
              a button that cannot work is worse than no button. */}
          {user ? (
            <VStack gap="md">
              <PrimaryButton
                label={t.reorder}
                icon="repeat-outline"
                onPress={() => void doReorder()}
                busy={busy}
              />
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/invoice/[name]", params: { name: order.name } })
                }
                style={{ alignItems: "center" }}
              >
                <Row gap="xs">
                  <Ionicons name="document-text-outline" size={15} color={c.blue} />
                  <Txt variant="label" tone="blue">
                    {t.invoice}
                  </Txt>
                </Row>
              </Pressable>
              <ContactSellers order={order} />
              <ReturnAction order={order} />
              {cancellable && (
                <Pressable onPress={doCancel} disabled={busy} style={{ alignItems: "center" }}>
                  <Txt variant="label" tone="coral">
                    {t.cancelOrder}
                  </Txt>
                </Pressable>
              )}
            </VStack>
          ) : (
            <Card>
              <VStack gap="md">
                <Txt variant="body" tone="muted">
                  {t.guestOrderHint}
                </Txt>
                <PrimaryButton
                  label={t.signIn}
                  icon="log-in-outline"
                  onPress={() => router.push("/auth/sign-in")}
                />
              </VStack>
            </Card>
          )}
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

/**
 * Ask to send this order back — or, once asked, what came of it.
 *
 * Deliberately one component for both: the request and its outcome are the
 * same conversation, and a shopper who has already asked must not be shown a
 * button that would file a second request. Only offered on an order that has
 * actually arrived; there is nothing to return before then, and the server
 * refuses it anyway.
 */
function ReturnAction({ order }: { order: Order }) {
  const t = dict();
  const { c, space } = useTheme();

  const [existing, setExisting] = useState<ReturnRequest | null>(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnable = order.status === "Completed";

  useEffect(() => {
    if (!returnable) {
      setChecked(true);
      return;
    }
    let alive = true;
    void orderReturn(order.name).then((found) => {
      if (!alive) return;
      setExisting(found);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [order.name, returnable]);

  if (!returnable || !checked) return null;

  if (existing) {
    return (
      <Card>
        <VStack gap="sm">
          <Row justify="space-between">
            <Txt variant="label">{t.returnRequested}</Txt>
            <ReturnStatusPill status={existing.status} />
          </Row>
          <Txt variant="caption" tone="muted">
            {returnReasonLabel(existing.reason)}
          </Txt>
          {!!existing.operator_note && (
            <Txt variant="caption" tone="faint">
              {existing.operator_note}
            </Txt>
          )}
        </VStack>
      </Card>
    );
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={{ alignItems: "center" }}>
        <Row gap="xs">
          <Ionicons name="refresh-outline" size={15} color={c.ink600} />
          <Txt variant="label" tone="muted">
            {t.returnRequest}
          </Txt>
        </Row>
      </Pressable>
    );
  }

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      setExisting(await requestReturn(order.name, reason, details.trim() || undefined));
      setOpen(false);
    } catch (err) {
      setError((err as Error)?.message ?? t.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <VStack gap="md">
        <Txt variant="label">{t.returnRequest}</Txt>
        <Txt variant="caption" tone="faint">
          {t.returnReason}
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {RETURN_REASONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setReason(option)}
              style={{
                borderWidth: 1,
                borderColor: reason === option ? c.blue : c.line,
                backgroundColor: reason === option ? c.blue050 : c.surface,
                borderRadius: 999,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
              }}
            >
              <Txt variant="caption" tone={reason === option ? "blue" : "muted"}>
                {returnReasonLabel(option)}
              </Txt>
            </Pressable>
          ))}
        </View>

        <Field
          label={t.returnDetails}
          value={details}
          onChange={setDetails}
          placeholder={t.returnDetailsHint}
          multiline
        />

        {!!error && (
          <Txt variant="caption" tone="coral">
            {error}
          </Txt>
        )}

        <PrimaryButton
          label={t.returnSend}
          onPress={() => void submit()}
          busy={busy}
          disabled={!reason}
        />
        <Pressable onPress={() => setOpen(false)} style={{ alignItems: "center" }}>
          <Txt variant="label" tone="faint">
            {t.cancel}
          </Txt>
        </Pressable>
      </VStack>
    </Card>
  );
}

/**
 * A way to reach the seller who is actually holding this parcel.
 *
 * The server decides who that is: an order split across three vendors has
 * three people who could answer, and which one depends on the item. Asking it
 * rather than guessing from the line items also means a single-vendor order
 * gets one button instead of a list of one.
 */
function ContactSellers({ order }: { order: Order }) {
  const t = dict();
  const { c } = useTheme();
  const router = useRouter();
  const [vendors, setVendors] = useState<Array<{ vendor: string; vendor_name?: string | null }>>([]);

  useEffect(() => {
    let alive = true;
    void orderVendors(order.name).then((found) => {
      if (alive) setVendors(found);
    });
    return () => {
      alive = false;
    };
  }, [order.name]);

  if (!vendors.length) return null;

  return (
    <VStack gap="sm">
      {vendors.map((seller) => (
        <Pressable
          key={seller.vendor}
          onPress={() =>
            router.push({
              pathname: "/messages/[order]/[vendor]",
              params: { order: order.name, vendor: seller.vendor },
            })
          }
          style={{ alignItems: "center" }}
        >
          <Row gap="xs">
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={c.blue} />
            <Txt variant="label" tone="blue">
              {vendors.length > 1
                ? fill(t.contactSeller, { name: seller.vendor_name || seller.vendor })
                : t.contactSellerOne}
            </Txt>
          </Row>
        </Pressable>
      ))}
    </VStack>
  );
}
