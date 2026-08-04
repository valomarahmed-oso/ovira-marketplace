import { trackOrder, type Order } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Field, PrimaryButton } from "../src/components/form";
import { OrderStatusPill } from "../src/components/order-status";
import { Screen, Card, Row, Txt, VStack } from "../src/components/ui";
import { dict, fill, formatDate, money, num } from "../src/i18n";
import { useTheme } from "../src/theme-context";

/**
 * Follow an order without signing in.
 *
 * The order id alone is not proof — ids are sequential and guessable — so the
 * server wants one of: the capability token from the confirmation link, the
 * phone used at checkout, or the account's email. It answers with the same
 * refusal in every failing case, so this screen must not try to explain *why*
 * a lookup failed. It doesn't know, and guessing would leak what the endpoint
 * is careful not to.
 */
export default function TrackScreen() {
  const t = dict();
  const { c, space, radius } = useTheme();

  // A tapped confirmation link arrives as /track?order=…&token=…
  const { order: urlOrder, token: urlToken } = useLocalSearchParams<{
    order?: string;
    token?: string;
  }>();

  const [orderNo, setOrderNo] = useState(String(urlOrder ?? ""));
  const [proof, setProof] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (name: string, opts: { token?: string; phone?: string; email?: string }) => {
      setBusy(true);
      setError(null);
      const found = await trackOrder({ name: name.trim(), ...opts });
      setOrder(found);
      if (!found) setError(t.trackNotFound);
      setBusy(false);
    },
    [t.trackNotFound],
  );

  // Straight through from the link — no form to fill in when the token is
  // already in hand.
  useEffect(() => {
    if (urlOrder && urlToken) void lookup(String(urlOrder), { token: String(urlToken) });
  }, [urlOrder, urlToken, lookup]);

  const submit = () => {
    const value = proof.trim();
    // An "@" is the only reliable way to tell the two apart, and sending a
    // phone number as an email simply fails the comparison rather than
    // matching something it shouldn't.
    void lookup(orderNo, value.includes("@") ? { email: value } : { phone: value });
  };

  return (
    <>
      <Stack.Screen options={{ title: t.track }} />
      <Screen>
        <VStack gap="xl" style={{ paddingBottom: space.xxl }}>
          <VStack gap="sm" style={{ alignItems: "center" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.xl,
                backgroundColor: c.blue050,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="location-outline" size={26} color={c.blue} />
            </View>
            <Txt variant="title">{t.track}</Txt>
            <Txt variant="body" tone="faint" style={{ textAlign: "center", maxWidth: 300 }}>
              {t.trackSubtitle}
            </Txt>
          </VStack>

          <Card>
            <VStack gap="md">
              <Field label={t.trackOrderNo} value={orderNo} onChange={setOrderNo} placeholder="OVR-000001" />
              <Field
                label={t.trackProof}
                value={proof}
                onChange={setProof}
                placeholder={t.trackProofHint}
              />
              <PrimaryButton
                label={t.trackLookup}
                icon="search"
                busy={busy}
                disabled={!orderNo.trim() || !proof.trim()}
                onPress={submit}
              />
              {!!error && (
                <Txt variant="caption" tone="coral" style={{ textAlign: "center" }}>
                  {error}
                </Txt>
              )}
            </VStack>
          </Card>

          {order && <TrackedOrder order={order} />}
        </VStack>
      </Screen>
    </>
  );
}

function TrackedOrder({ order }: { order: Order }) {
  const t = dict();
  const { c, radius } = useTheme();

  return (
    <VStack gap="lg">
      <Card>
        <VStack gap="md">
          <Row justify="space-between">
            <VStack gap="xs">
              <Txt variant="heading">{order.name}</Txt>
              <Txt variant="caption" tone="faint">
                {t.orderDate} {formatDate(order.creation)}
              </Txt>
            </VStack>
            <OrderStatusPill status={order.status} />
          </Row>

          {!!order.delivered_on && (
            <Row gap="sm">
              <Ionicons name="checkmark-circle" size={16} color={c.mint} />
              <Txt variant="caption" tone="mint">
                {fill(t.trackDeliveredOn, { date: formatDate(order.delivered_on) })}
              </Txt>
            </Row>
          )}

          {!!order.shipping_address && (
            <VStack gap="xs">
              <Txt variant="caption" tone="faint">
                {t.trackDelivery}
              </Txt>
              <Txt variant="body" tone="muted">
                {order.shipping_address}
                {order.governorate ? `، ${order.governorate}` : ""}
              </Txt>
            </VStack>
          )}
        </VStack>
      </Card>

      {!!order.items?.length && (
        <VStack gap="sm">
          {order.items.map((item, index) => (
            <Card key={`${item.title}-${index}`}>
              <Row gap="md">
                {item.image ? (
                  <Image
                    source={item.image}
                    style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: c.blue050 }}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: radius.md,
                      backgroundColor: c.blue050,
                    }}
                  />
                )}
                <VStack gap="xs" style={{ flex: 1 }}>
                  <Txt variant="label" numberOfLines={2}>
                    {item.title}
                  </Txt>
                  <Row justify="space-between">
                    <Txt variant="caption" tone="faint">
                      {t.qty} {num(item.qty)}
                    </Txt>
                    <Txt variant="caption">{money(item.amount)}</Txt>
                  </Row>
                </VStack>
              </Row>
            </Card>
          ))}
        </VStack>
      )}

      <Card>
        <VStack gap="sm">
          <Row justify="space-between">
            <Txt variant="body" tone="muted">
              {t.subtotal}
            </Txt>
            <Txt variant="body">{money(order.subtotal)}</Txt>
          </Row>
          <Row justify="space-between">
            <Txt variant="body" tone="muted">
              {t.shipping}
            </Txt>
            <Txt variant="body" tone={order.shipping_amount === 0 ? "mint" : "ink"}>
              {order.shipping_amount === 0 ? t.free : money(order.shipping_amount)}
            </Txt>
          </Row>
          {!!order.discount_amount && order.discount_amount > 0 && (
            <Row justify="space-between">
              <Txt variant="body" tone="muted">
                {t.discountLabel}
                {order.coupon_code ? ` (${order.coupon_code})` : ""}
              </Txt>
              <Txt variant="body" tone="mint">
                −{money(order.discount_amount)}
              </Txt>
            </Row>
          )}
          {/* Store credit is why the total can be less than subtotal +
              shipping. Leaving it out made the arithmetic look broken. */}
          {!!order.wallet_applied && order.wallet_applied > 0 && (
            <Row justify="space-between">
              <Txt variant="body" tone="muted">
                {t.walletApplied}
              </Txt>
              <Txt variant="body" tone="mint">
                −{money(order.wallet_applied)}
              </Txt>
            </Row>
          )}
          <View style={{ height: 1, backgroundColor: c.line }} />
          <Row justify="space-between">
            <Txt variant="heading">{t.total}</Txt>
            <Txt variant="heading" tone="blue">
              {money(order.total)}
            </Txt>
          </Row>
          {/* An order settled entirely from the balance was not paid in cash,
              and saying "Cash on Delivery" invites the buyer to hand money to a
              courier for something already paid for. */}
          <Row justify="space-between">
            <Txt variant="caption" tone="faint">
              {t.paymentMethod}
            </Txt>
            <Txt variant="caption" tone="muted">
              {order.total <= 0 && !!order.wallet_applied
                ? t.paidWithWallet
                : order.payment_method === "cod"
                  ? t.cod
                  : order.payment_method || "—"}
            </Txt>
          </Row>
        </VStack>
      </Card>
    </VStack>
  );
}
