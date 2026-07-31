import { cartTotals } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { cartKey, useCart } from "../../src/cart-store";
import { Empty } from "../../src/components/states";
import { Card, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, money, num } from "../../src/i18n";
import { useStoreConfig } from "../../src/store-config";
import { useTheme } from "../../src/theme-context";

/**
 * The cart, as far as this slice goes: what's in it and what it comes to.
 *
 * Placing the order is the next slice. The totals shown here come from
 * `cartTotals` in the shared package — the same function the web storefront
 * uses and the same order of operations `totals.py` applies on the server — so
 * when checkout is wired up the number will not change under the shopper.
 *
 * Shipping is shown as "calculated at checkout" rather than as 0. It genuinely
 * isn't known yet: this store prices shipping per governorate (or per vendor),
 * and printing a zero would be a quote it can't honour.
 */
export default function CartScreen() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const config = useStoreConfig();
  const t = dict();

  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const totals = cartTotals({ lines, tax: config?.tax ?? null });

  if (!lines.length) {
    return (
      <Screen scroll={false} style={{ justifyContent: "center" }}>
        <Empty icon="cart-outline" title={t.cartEmpty} body={t.cartEmptyBody} />
        <Pressable
          onPress={() => router.push("/")}
          style={{
            alignSelf: "center",
            backgroundColor: c.blue,
            borderRadius: radius.pill,
            paddingHorizontal: space.xl,
            paddingVertical: space.md,
          }}
        >
          <Txt variant="label" tone="onBlue">
            {t.startShopping}
          </Txt>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: space.md, paddingBottom: space.xxl }}
      >
        {lines.map((line) => {
          const key = cartKey(line);
          return (
            <Card key={key}>
              <Row gap="md" align="flex-start">
                <Image
                  source={line.image}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: radius.md,
                    backgroundColor: c.blue050,
                  }}
                  contentFit="cover"
                />
                <VStack gap="xs" style={{ flex: 1 }}>
                  <Txt variant="label" numberOfLines={2}>
                    {line.title}
                  </Txt>
                  {!!line.variantLabel && (
                    <Txt variant="caption" tone="faint">
                      {line.variantLabel}
                    </Txt>
                  )}
                  <Txt variant="heading" tone="blue">
                    {money(line.price * line.qty)}
                  </Txt>

                  <Row justify="space-between" style={{ marginTop: space.xs }}>
                    <Row
                      gap="xs"
                      style={{
                        borderWidth: 1,
                        borderColor: c.line,
                        borderRadius: radius.pill,
                        paddingHorizontal: space.sm,
                      }}
                    >
                      <Pressable
                        onPress={() => setQty(key, line.qty - 1)}
                        hitSlop={6}
                        style={{ padding: 6 }}
                      >
                        <Ionicons name="remove" size={16} color={c.ink} />
                      </Pressable>
                      <Txt variant="label" style={{ minWidth: 24, textAlign: "center" }}>
                        {num(line.qty)}
                      </Txt>
                      <Pressable
                        onPress={() => setQty(key, line.qty + 1)}
                        hitSlop={6}
                        disabled={!!line.stock_qty && line.qty >= line.stock_qty}
                        style={{
                          padding: 6,
                          opacity: !!line.stock_qty && line.qty >= line.stock_qty ? 0.35 : 1,
                        }}
                      >
                        <Ionicons name="add" size={16} color={c.ink} />
                      </Pressable>
                    </Row>

                    <Pressable onPress={() => remove(key)} hitSlop={6}>
                      <Txt variant="caption" tone="coral">
                        {t.remove}
                      </Txt>
                    </Pressable>
                  </Row>
                </VStack>
              </Row>
            </Card>
          );
        })}

        <Card>
          <VStack gap="sm">
            <Row justify="space-between">
              <Txt variant="body" tone="muted">
                {t.subtotal}
              </Txt>
              <Txt variant="label">{money(totals.subtotal)}</Txt>
            </Row>

            {config?.tax && (
              <Row justify="space-between">
                <Txt variant="body" tone="muted">
                  {config.tax.label || t.tax}
                </Txt>
                <Txt variant="label" tone={totals.taxInclusive ? "faint" : "ink"}>
                  {money(totals.tax)}
                </Txt>
              </Row>
            )}

            <Row justify="space-between">
              <Txt variant="body" tone="muted">
                {t.shipping}
              </Txt>
              <Txt variant="caption" tone="faint">
                {t.shippingAtCheckout}
              </Txt>
            </Row>

            <View style={{ height: 1, backgroundColor: c.line, marginVertical: space.xs }} />

            <Row justify="space-between">
              <Txt variant="heading">{t.total}</Txt>
              <Txt variant="title" tone="blue">
                {money(totals.total)}
              </Txt>
            </Row>
          </VStack>
        </Card>

        <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
          {t.checkoutSoon}
        </Txt>
      </ScrollView>
    </Screen>
  );
}
