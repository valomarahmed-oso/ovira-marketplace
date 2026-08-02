import type { Product, ProductCard, ProductVariant } from "@ovira/core";
import {
  alertStatus,
  getProduct,
  nextTier,
  relatedProducts,
  subscribeStockAlert,
  tierUnitRate,
  unsubscribeStockAlert,
} from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useCart } from "../../src/cart-store";
import { COMPARE_MAX, inCompare, useCompare } from "../../src/compare-store";
import { Gallery } from "../../src/components/gallery";
import { Price } from "../../src/components/price";
import { ProductTile } from "../../src/components/product-card";
import { Rating } from "../../src/components/rating";
import { Empty, Loading } from "../../src/components/states";
import { Card, Pill, Row, Screen, Txt, VStack } from "../../src/components/ui";
import { dict, fill, money, num } from "../../src/i18n";
import { useStoreConfig } from "../../src/store-config";
import { useTheme } from "../../src/theme-context";
import { inWishlist, pushWishlist, useWishlist } from "../../src/wishlist-store";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c, space, radius } = useTheme();
  const config = useStoreConfig();
  const addToCart = useCart((s) => s.add);
  const t = dict();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<ProductCard[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    let alive = true;
    const key = String(slug ?? "");
    setState("loading");
    void (async () => {
      const found = await getProduct(key);
      if (!alive) return;
      if (!found) {
        setState("missing");
        return;
      }
      setProduct(found);
      setState("ready");
      // A variant product has no meaningful price until one is chosen, so the
      // first in-stock option is pre-selected rather than leaving the buy button
      // disabled on arrival.
      const options = found.variants ?? [];
      setVariant(options.find((v) => v.stock_qty > 0) ?? options[0] ?? null);
      setRelated(await relatedProducts(key, 8));
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const unitBase = variant?.price || product?.price || 0;
  const tiers = product?.price_tiers ?? [];
  // What this quantity actually costs per unit — the same rule the server
  // applies at checkout, not a separate guess made in the view.
  const unit = tierUnitRate(unitBase, qty, tiers);
  const upcoming = nextTier(qty, tiers);
  const stock = variant ? variant.stock_qty : (product?.stock_qty ?? 0);
  const soldOut = stock <= 0;

  const add = useCallback(() => {
    if (!product || soldOut) return;
    addToCart({
      slug: product.slug,
      title: product.title,
      // The BASE rate plus the tiers, not the discounted figure on screen. The
      // cart re-derives the effective price from the quantity, so the discount
      // follows the line instead of being frozen into it.
      price: unitBase,
      tiers,
      qty,
      image: product.image,
      variant: variant?.sku ?? variant?.name ?? null,
      variantLabel: variant?.option_value ?? null,
      vendor_name: product.vendor_name,
      stock_qty: stock,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  }, [product, soldOut, addToCart, unit, qty, variant, stock]);

  if (state === "loading") {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }

  if (state === "missing" || !product) {
    return (
      <>
        <Stack.Screen options={{ title: t.productMissing }} />
        <Screen scroll={false}>
          <Empty
            icon="alert-circle-outline"
            title={t.productMissing}
            body={t.productMissingBody}
          />
        </Screen>
      </>
    );
  }

  const media = product.media?.length
    ? product.media
    : product.image
      ? [{ image: product.image }]
      : [];

  return (
    <>
      <Stack.Screen options={{ title: product.title }} />
      <View style={{ flex: 1, backgroundColor: c.canvas }}>
        <Screen>
          <VStack gap="lg">
            <Gallery images={media} />

            <VStack gap="sm">
              <Txt variant="title">{product.title}</Txt>
              {(product.review_count ?? 0) > 0 ? (
                <Rating value={product.rating} count={product.review_count} size={15} />
              ) : (
                <Txt variant="caption" tone="faint">
                  {t.noReviews}
                </Txt>
              )}
            </VStack>

            <VStack gap="xs">
              <Price price={unit} compareAt={product.compare_at_price} size="title" />
              {config?.tax && (
                // Whether VAT is already inside this number is the single
                // question the owner opened this whole project with. It is
                // answered here, on the price, not buried in a policy page.
                <Txt variant="caption" tone="faint">
                  {fill(config.tax.inclusive ? t.taxIncluded : t.taxAdded, {
                    label: config.tax.label || `${config.tax.rate}%`,
                  })}
                </Txt>
              )}
              <StockLine stock={stock} />
            </VStack>

            <SaveActions product={product} soldOut={soldOut} />

            {!!product.variants?.length && (
              <VStack gap="sm">
                <Txt variant="label" tone="muted">
                  {fill(t.chooseOption, { option: product.variant_option_name || "" }).trim()}
                </Txt>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {product.variants.map((option) => {
                    const on = variant?.name === option.name;
                    const gone = option.stock_qty <= 0;
                    return (
                      <Pressable
                        key={option.name}
                        onPress={() => {
                          setVariant(option);
                          // A quantity valid for the last option may exceed this
                          // one's stock; silently carrying it over is how a cart
                          // ends up holding more than exists.
                          setQty(1);
                        }}
                        disabled={gone}
                        style={{
                          borderWidth: 1,
                          borderColor: on ? c.blue : c.line,
                          backgroundColor: on ? c.blue050 : c.surface,
                          borderRadius: radius.md,
                          paddingHorizontal: space.lg,
                          paddingVertical: space.sm,
                          opacity: gone ? 0.45 : 1,
                        }}
                      >
                        <Txt variant="label" tone={on ? "blue" : "muted"}>
                          {option.option_value}
                          {option.option_value2 ? ` · ${option.option_value2}` : ""}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </VStack>
            )}

            {tiers.length > 0 && (
              <Card>
                <VStack gap="sm">
                  <Row gap="sm">
                    <Ionicons name="layers-outline" size={16} color={c.blue} />
                    <Txt variant="heading">{t.bulkPricing}</Txt>
                  </Row>
                  {tiers.map((tier) => (
                    <Row key={tier.min_qty} justify="space-between">
                      <Txt variant="body" tone="muted">
                        {fill(t.bulkFrom, { n: num(tier.min_qty) })}
                      </Txt>
                      <Txt variant="label" tone="blue">
                        {money(tier.price)}
                      </Txt>
                    </Row>
                  ))}
                  {upcoming && (
                    <Txt variant="caption" tone="mint">
                      {fill(t.bulkHint, {
                        n: num(upcoming.min_qty),
                        price: money(upcoming.price),
                      })}
                    </Txt>
                  )}
                </VStack>
              </Card>
            )}

            {!!product.short_description && (
              <Txt variant="body" tone="muted">
                {product.short_description}
              </Txt>
            )}

            {!!product.description && (
              <VStack gap="sm">
                <Txt variant="heading">{t.aboutProduct}</Txt>
                <Txt variant="body" tone="muted">
                  {product.description}
                </Txt>
              </VStack>
            )}

            {!!product.attributes?.length && (
              <VStack gap="sm">
                <Txt variant="heading">{t.specs}</Txt>
                <Card>
                  <VStack gap="sm">
                    {product.attributes.map((spec, i) => (
                      <Row key={`${spec.attribute}-${i}`} justify="space-between">
                        <Txt variant="body" tone="faint">
                          {spec.attribute}
                        </Txt>
                        <Txt variant="label">{spec.value}</Txt>
                      </Row>
                    ))}
                  </VStack>
                </Card>
              </VStack>
            )}

            {!!product.vendor_name && (
              <Card>
                <Row justify="space-between">
                  <VStack gap="xs">
                    <Txt variant="caption" tone="faint">
                      {t.soldBy}
                    </Txt>
                    <Txt variant="heading">{product.vendor_name}</Txt>
                    {product.vendor_trust_score != null && (
                      <Rating value={product.vendor_trust_score} showValue />
                    )}
                  </VStack>
                  {product.vendor_trust_tier === "trusted" && (
                    <Ionicons name="shield-checkmark" size={22} color={c.mint} />
                  )}
                </Row>
              </Card>
            )}

            {related.length > 0 && (
              <VStack gap="md">
                <Txt variant="heading">{t.relatedProducts}</Txt>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space.md, paddingBottom: space.xs }}
                >
                  {related.map((p) => (
                    <ProductTile key={p.name} product={p} width={158} />
                  ))}
                </ScrollView>
              </VStack>
            )}

            {/* Room for the buy bar, which floats over the scroll. */}
            <View style={{ height: 72 }} />
          </VStack>
        </Screen>

        <BuyBar
          soldOut={soldOut}
          stock={stock}
          qty={qty}
          setQty={setQty}
          total={unit * qty}
          added={justAdded}
          onAdd={add}
        />
      </View>
    </>
  );
}

function StockLine({ stock }: { stock: number }) {
  const t = dict();
  if (stock <= 0) return <Pill label={t.outOfStock} tone="coral" />;
  if (stock <= 5) {
    return (
      <Txt variant="label" tone="coral">
        {fill(t.lowStock, { n: num(stock) })}
      </Txt>
    );
  }
  return (
    <Txt variant="label" tone="mint">
      {fill(t.inStock, { n: num(stock) })}
    </Txt>
  );
}

/**
 * The buy bar, pinned above the content.
 *
 * The stepper refuses to go past the stock figure rather than letting the
 * shopper reach checkout and be told there. It is the same number either way;
 * the difference is whether they find out before or after entering an address.
 */
function BuyBar({
  soldOut,
  stock,
  qty,
  setQty,
  total,
  added,
  onAdd,
}: {
  soldOut: boolean;
  stock: number;
  qty: number;
  setQty: (n: number) => void;
  total: number;
  added: boolean;
  onAdd: () => void;
}) {
  const { c, space, radius, shadow } = useTheme();
  const t = dict();

  return (
    <View
      style={[
        {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.line,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: space.xl,
        },
        shadow(2),
      ]}
    >
      {!soldOut && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: radius.pill,
          }}
        >
          <Stepper icon="remove" onPress={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} />
          <Txt variant="label" style={{ minWidth: 30, textAlign: "center" }}>
            {num(qty)}
          </Txt>
          <Stepper
            icon="add"
            onPress={() => setQty(Math.min(stock, qty + 1))}
            disabled={qty >= stock}
          />
        </View>
      )}

      <Pressable
        onPress={onAdd}
        disabled={soldOut}
        style={{
          flex: 1,
          backgroundColor: soldOut ? c.line : added ? c.mint : c.blue,
          borderRadius: radius.pill,
          paddingVertical: space.md,
          alignItems: "center",
        }}
      >
        <Txt variant="label" tone={soldOut ? "faint" : "onBlue"}>
          {soldOut ? t.outOfStock : added ? t.added : `${t.addToCart} · ${money(total)}`}
        </Txt>
      </Pressable>
    </View>
  );
}

function Stepper({
  icon,
  onPress,
  disabled,
}: {
  icon: "add" | "remove";
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={{ paddingHorizontal: 14, paddingVertical: 10, opacity: disabled ? 0.35 : 1 }}
    >
      <Ionicons name={icon} size={18} color={c.ink} />
    </Pressable>
  );
}

/**
 * Save it, compare it, or ask to be told when it comes back.
 *
 * The three things a shopper does with a product they are not buying right
 * now. Wishlist and compare are device-local and work signed out; the stock
 * alert cannot be — there is nowhere to send the notification — so it says so
 * instead of failing silently when tapped by a guest.
 */
function SaveActions({ product, soldOut }: { product: Product; soldOut: boolean }) {
  const { c, space, radius } = useTheme();
  const t = dict();
  const router = useRouter();

  const wishItems = useWishlist((s) => s.items);
  const toggleWish = useWishlist((s) => s.toggle);
  const saved = inWishlist(wishItems, product.slug);

  const compareItems = useCompare((s) => s.items);
  const toggleCompare = useCompare((s) => s.toggle);
  const comparing = inCompare(compareItems, product.slug);

  const [alerting, setAlerting] = useState<boolean | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Only asked when it matters. A product in stock has no alert to show, and
  // the endpoint is login-gated — asking on every product page would be a
  // round trip per view to answer a question nobody posed.
  useEffect(() => {
    if (!soldOut) return;
    let alive = true;
    void alertStatus(product.slug).then((status) => {
      if (alive) setAlerting(status.authenticated ? status.subscribed : null);
    });
    return () => {
      alive = false;
    };
  }, [product.slug, soldOut]);

  const onWish = () => {
    toggleWish(product);
    if (!saved) setNotice(t.wishAdded);
    // Mirrored after the local change, never before it: the shopper's own
    // device is the copy that must be right.
    void pushWishlist();
  };

  const onCompare = () => {
    if (!comparing && compareItems.length >= COMPARE_MAX) {
      setNotice(t.compareFull);
      return;
    }
    toggleCompare(product);
  };

  const onAlert = async () => {
    setAlertBusy(true);
    try {
      const on = alerting
        ? await unsubscribeStockAlert(product.slug)
        : await subscribeStockAlert(product.slug);
      setAlerting(on);
      if (on) setNotice(t.notifyOn);
    } catch {
      setNotice(t.signInFirst);
    } finally {
      setAlertBusy(false);
    }
  };

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 1800);
    return () => clearTimeout(id);
  }, [notice]);

  const chip = (on: boolean) => ({
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: space.sm,
    borderWidth: 1,
    borderColor: on ? c.blue : c.line,
    backgroundColor: on ? c.blue050 : c.surface,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
  });

  return (
    <VStack gap="sm">
      <Row gap="sm">
        <Pressable onPress={onWish} style={chip(saved)}>
          <Ionicons
            name={saved ? "heart" : "heart-outline"}
            size={17}
            color={saved ? c.coral : c.ink600}
          />
          <Txt variant="label" tone={saved ? "blue" : "muted"}>
            {t.wishlist}
          </Txt>
        </Pressable>

        <Pressable onPress={onCompare} style={chip(comparing)}>
          <Ionicons name="git-compare-outline" size={17} color={comparing ? c.blue : c.ink600} />
          <Txt variant="label" tone={comparing ? "blue" : "muted"}>
            {t.compare}
          </Txt>
        </Pressable>
      </Row>

      {/* Only for something that cannot be bought right now — offering to
          notify someone about an item sitting in front of them is noise. */}
      {soldOut && (
        <Pressable onPress={() => void onAlert()} disabled={alertBusy} style={chip(!!alerting)}>
          <Ionicons
            name={alerting ? "notifications" : "notifications-outline"}
            size={17}
            color={alerting ? c.blue : c.ink600}
          />
          <Txt variant="label" tone={alerting ? "blue" : "muted"}>
            {alerting ? t.alertWaiting : t.notifyMe}
          </Txt>
        </Pressable>
      )}

      {comparing && compareItems.length > 1 && (
        <Pressable onPress={() => router.push("/compare")} style={{ alignItems: "center" }}>
          <Txt variant="caption" tone="blue">
            {t.compareOpen} ({num(compareItems.length)})
          </Txt>
        </Pressable>
      )}

      {!!notice && (
        <Txt variant="caption" tone="mint" style={{ textAlign: "center" }}>
          {notice}
        </Txt>
      )}
    </VStack>
  );
}
