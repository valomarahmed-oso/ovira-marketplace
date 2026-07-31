import type { BuyerAddress, ShippingMethod, ShippingQuote } from "@ovira/core";
import {
  GOVERNORATES,
  cartTotals,
  getWallet,
  listCarriers,
  listShippingMethods,
  myAddresses,
  placeOrder,
  saveAddress,
  shippingQuote,
  validateCoupon,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { useCart } from "../src/cart-store";
import { ChoiceRow, Field, OptionCard, PrimaryButton, Toggle } from "../src/components/form";
import { Card, Row, Screen, Txt, VStack } from "../src/components/ui";
import { useGuestOrders } from "../src/guest-orders";
import { dict, fill, money, num } from "../src/i18n";
import { useSession } from "../src/session";
import { useStoreConfig } from "../src/store-config";
import { useTheme } from "../src/theme-context";

/** Egyptian mobile numbers: 11 digits starting 010/011/012/015. */
const PHONE = /^01[0125]\d{8}$/;

export default function CheckoutScreen() {
  const { c, space } = useTheme();
  const router = useRouter();
  const config = useStoreConfig();
  const user = useSession((s) => s.user);
  const t = dict();

  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const rememberGuestOrder = useGuestOrders((s) => s.remember);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [gov, setGov] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState<BuyerAddress[]>([]);
  const [pickedAddress, setPickedAddress] = useState<string | null>(null);
  const [keepAddress, setKeepAddress] = useState(true);

  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [method, setMethod] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<string[]>([]);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [quote, setQuote] = useState<ShippingQuote | null>(null);

  const [payment, setPayment] = useState<"cod" | "card">("cod");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(
    null,
  );
  const [couponError, setCouponError] = useState("");

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [useWallet, setUseWallet] = useState(false);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // -- what the shopper's own account already knows ------------------------
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [rows, purse] = await Promise.all([myAddresses(), getWallet(1)]);
      setSaved(rows);
      setWalletBalance(purse?.balance ?? null);
      const preferred = rows.find((a) => a.is_default) ?? rows[0];
      if (preferred) applyAddress(preferred);
    })();
    // `applyAddress` only writes state; re-running on identity change is right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    void listShippingMethods().then((rows) => {
      setMethods(rows);
      setMethod((current) => current ?? rows.find((m) => m.is_default)?.name ?? rows[0]?.name ?? null);
    });
    void listCarriers().then((rows) => setCarriers(rows.map((r) => r.carrier_name)));
  }, []);

  function applyAddress(row: BuyerAddress) {
    setPickedAddress(row.name);
    setName(row.full_name);
    setPhone(row.phone ?? "");
    setGov(row.governorate);
    setAddress(row.address);
  }

  /**
   * Shipping is asked of the server every time the governorate or method
   * changes, and never computed here.
   *
   * This store prices delivery two incompatible ways depending on a setting —
   * one operator rate table, or each vendor's own rules summed per seller — and
   * a client that reproduced either would be wrong the first time the operator
   * switched mode.
   */
  useEffect(() => {
    if (!lines.length) return;
    let alive = true;
    void shippingQuote(lines, gov ?? undefined, method ?? undefined).then((q) => {
      if (alive) setQuote(q);
    });
    return () => {
      alive = false;
    };
  }, [lines, gov, method]);

  const totals = useMemo(
    () =>
      cartTotals({
        lines,
        shipping: quote?.total ?? 0,
        discount: couponApplied?.discount ?? 0,
        walletBalance: walletBalance ?? 0,
        useWallet,
        tax: config?.tax ?? null,
      }),
    [lines, quote, couponApplied, walletBalance, useWallet, config],
  );

  const applyCoupon = useCallback(async () => {
    const code = coupon.trim();
    if (!code) return;
    setCouponError("");
    const result = await validateCoupon(code, totals.subtotal);
    if (result.discount > 0) setCouponApplied({ code, discount: result.discount });
    else {
      setCouponApplied(null);
      setCouponError(result.reason ?? t.loadFailed);
    }
  }, [coupon, totals.subtotal, t.loadFailed]);

  const submit = useCallback(async () => {
    setError("");
    if (!name.trim() || !gov || !address.trim()) {
      setError(t.requiredFields);
      return;
    }
    if (!PHONE.test(phone.trim())) {
      setError(t.invalidPhone);
      return;
    }

    setBusy(true);
    try {
      const order = await placeOrder({
        lines,
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          email: user?.email,
          gov,
          address: address.trim(),
        },
        paymentMethod: payment,
        coupon: couponApplied?.code,
        useWallet,
        shippingMethod: method ?? undefined,
        preferredCarrier: carrier ?? undefined,
      });

      if (keepAddress && user && !pickedAddress) {
        // Best effort: a saved address is a convenience, and failing to store it
        // must not cast doubt on an order that has already been placed.
        void saveAddress({
          full_name: name.trim(),
          phone: phone.trim(),
          governorate: gov,
          address: address.trim(),
          is_default: saved.length ? 0 : 1,
        }).catch(() => {});
      }

      // A guest has no session that owns this order; the token the server just
      // handed back is their only way to look at it again. Kept before the
      // cart is cleared so a failure here cannot lose both.
      if (!user) rememberGuestOrder(order.name, order.token);

      clearCart();
      router.replace({ pathname: "/order/[name]", params: { name: order.name, placed: "1" } });
    } catch (err) {
      // The write layer throws with the server's own sentence — "الكمية غير
      // متاحة", "الكوبون منتهي" — which is far more use than a generic failure.
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setBusy(false);
    }
  }, [
    name, gov, address, phone, lines, user, payment, couponApplied, useWallet, method, carrier,
    keepAddress, pickedAddress, saved.length, clearCart, rememberGuestOrder, router,
    t.requiredFields, t.invalidPhone, t.loadFailed,
  ]);

  if (!lines.length) {
    return (
      <>
        <Stack.Screen options={{ title: t.checkout }} />
        <Screen scroll={false} style={{ justifyContent: "center" }}>
          <Txt variant="heading" style={{ textAlign: "center" }}>
            {t.cartEmpty}
          </Txt>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.checkout }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Screen>
          <VStack gap="xl">
            {!user && (
              <Card>
                <VStack gap="md">
                  <Txt variant="body" tone="muted">
                    {t.signInBenefit}
                  </Txt>
                  <PrimaryButton
                    label={t.signIn}
                    icon="log-in-outline"
                    onPress={() =>
                      router.push({ pathname: "/auth/sign-in", params: { next: "checkout" } })
                    }
                  />
                </VStack>
              </Card>
            )}

            {saved.length > 0 && (
              <VStack gap="md">
                <Txt variant="heading">{t.savedAddresses}</Txt>
                {saved.map((row) => (
                  <OptionCard
                    key={row.name}
                    selected={pickedAddress === row.name}
                    onPress={() => applyAddress(row)}
                  >
                    <Txt variant="label">{row.full_name}</Txt>
                    <Txt variant="caption" tone="faint" numberOfLines={2}>
                      {row.governorate} · {row.address}
                    </Txt>
                  </OptionCard>
                ))}
                <Pressable
                  onPress={() => {
                    setPickedAddress(null);
                    setAddress("");
                  }}
                >
                  <Txt variant="label" tone="blue">
                    + {t.newAddress}
                  </Txt>
                </Pressable>
              </VStack>
            )}

            <VStack gap="md">
              <Txt variant="heading">{t.deliveryDetails}</Txt>
              <Field label={t.fullName} value={name} onChange={setName} autoCapitalize="words" />
              <Field
                label={t.phone}
                value={phone}
                onChange={setPhone}
                keyboardType="phone-pad"
                placeholder="01xxxxxxxxx"
              />
              <VStack gap="xs">
                <Txt variant="label" tone="muted">
                  {t.governorate}
                </Txt>
                <ChoiceRow
                  options={GOVERNORATES.map((g) => ({ value: g, label: g }))}
                  value={gov}
                  onChange={setGov}
                />
              </VStack>
              <Field
                label={t.address}
                value={address}
                onChange={setAddress}
                placeholder={t.addressHint}
                multiline
              />
              {user && !pickedAddress && (
                <Toggle label={t.saveAddress} value={keepAddress} onChange={setKeepAddress} />
              )}
            </VStack>

            {methods.length > 0 && (
              <VStack gap="md">
                <Txt variant="heading">{t.deliveryMethod}</Txt>
                {methods.map((option) => {
                  const on = method === option.name;
                  const window =
                    option.eta_max_days <= 1
                      ? t.etaOneDay
                      : fill(t.etaDays, {
                          min: num(option.eta_min_days),
                          max: num(option.eta_max_days),
                        });
                  return (
                    <OptionCard key={option.name} selected={on} onPress={() => setMethod(option.name)}>
                      <Row justify="space-between">
                        <VStack gap="xs" style={{ flex: 1 }}>
                          <Txt variant="label">{option.method_name}</Txt>
                          <Txt variant="caption" tone="faint">
                            {window}
                          </Txt>
                        </VStack>
                        {option.surcharge > 0 && (
                          <Txt variant="caption" tone="muted">
                            + {money(option.surcharge)}
                          </Txt>
                        )}
                      </Row>
                    </OptionCard>
                  );
                })}
              </VStack>
            )}

            {carriers.length > 0 && (
              <VStack gap="sm">
                <Txt variant="heading">{t.preferredCarrier}</Txt>
                <Txt variant="caption" tone="faint">
                  {t.carrierNote}
                </Txt>
                <ChoiceRow
                  options={[
                    { value: "", label: t.noPreference },
                    ...carriers.map((name) => ({ value: name, label: name })),
                  ]}
                  value={carrier ?? ""}
                  onChange={(value) => setCarrier(value || null)}
                />
              </VStack>
            )}

            <VStack gap="md">
              <Txt variant="heading">{t.paymentMethod}</Txt>
              <OptionCard selected={payment === "cod"} onPress={() => setPayment("cod")}>
                <Txt variant="label">{t.cod}</Txt>
              </OptionCard>
              <OptionCard
                selected={payment === "card"}
                disabled={!config?.onlinePayment}
                onPress={() => setPayment("card")}
              >
                <Txt variant="label">{t.card}</Txt>
                {!config?.onlinePayment && (
                  <Txt variant="caption" tone="faint">
                    {t.cardUnavailable}
                  </Txt>
                )}
              </OptionCard>
            </VStack>

            <VStack gap="sm">
              <Txt variant="heading">{t.couponCode}</Txt>
              <Row gap="sm" align="flex-end">
                <View style={{ flex: 1 }}>
                  <Field label="" value={coupon} onChange={setCoupon} autoCapitalize="none" />
                </View>
                <Pressable
                  onPress={() => void applyCoupon()}
                  style={{ paddingVertical: space.md, paddingHorizontal: space.lg }}
                >
                  <Txt variant="label" tone="blue">
                    {t.apply}
                  </Txt>
                </Pressable>
              </Row>
              {!!couponApplied && (
                <Row gap="xs">
                  <Ionicons name="checkmark-circle" size={14} color={c.mint} />
                  <Txt variant="caption" tone="mint">
                    {t.couponApplied} · −{money(couponApplied.discount)}
                  </Txt>
                </Row>
              )}
              {!!couponError && (
                <Txt variant="caption" tone="coral">
                  {couponError}
                </Txt>
              )}
            </VStack>

            {!!walletBalance && walletBalance > 0 && (
              <Toggle
                label={t.useWallet}
                hint={fill(t.walletBalance, { amount: money(walletBalance) })}
                value={useWallet}
                onChange={setUseWallet}
              />
            )}

            <Card>
              <VStack gap="sm">
                <Line label={t.subtotal} value={money(totals.subtotal)} />
                {totals.discount > 0 && (
                  <Line label={t.discountLabel} value={`−${money(totals.discount)}`} tone="mint" />
                )}
                {config?.tax && (
                  <Line
                    label={config.tax.label || t.tax}
                    value={money(totals.tax)}
                    tone={totals.taxInclusive ? "faint" : "ink"}
                  />
                )}
                <Line
                  label={t.shipping}
                  value={quote ? money(totals.shipping) : t.shippingAtCheckout}
                />
                {totals.walletApplied > 0 && (
                  <Line
                    label={t.wallet}
                    value={`−${money(totals.walletApplied)}`}
                    tone="mint"
                  />
                )}
                <View style={{ height: 1, backgroundColor: c.line, marginVertical: space.xs }} />
                <Row justify="space-between">
                  <Txt variant="heading">{t.total}</Txt>
                  <Txt variant="title" tone="blue">
                    {money(totals.total)}
                  </Txt>
                </Row>
              </VStack>
            </Card>

            {!!error && (
              <Txt variant="body" tone="coral" style={{ textAlign: "center" }}>
                {error}
              </Txt>
            )}

            <PrimaryButton
              label={busy ? t.placing : `${t.placeOrder} · ${money(totals.total)}`}
              onPress={() => void submit()}
              busy={busy}
            />
            <View style={{ height: space.xl }} />
          </VStack>
        </Screen>
      </KeyboardAvoidingView>
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
      <Txt variant="body" tone="muted">
        {label}
      </Txt>
      <Txt variant="label" tone={tone}>
        {value}
      </Txt>
    </Row>
  );
}
