import type { ProductCard } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { PrimaryButton } from "../src/components/form";
import { Empty } from "../src/components/states";
import { Row, Screen, Txt, VStack } from "../src/components/ui";
import { useCart } from "../src/cart-store";
import { useCompare } from "../src/compare-store";
import { dict, money, num } from "../src/i18n";
import { useTheme } from "../src/theme-context";

/** Width of one product column. Two fit on a phone; the rest scroll into view. */
const COL = 150;
const LABELS = 92;

/**
 * Products side by side.
 *
 * The web puts this in a table that scrolls sideways; so does this, for the
 * same reason — the value of a comparison is that the same row means the same
 * thing across every column, and stacking the products into cards throws that
 * away. The label column stays put while the products scroll past it.
 */
export default function CompareScreen() {
  const t = dict();
  const { c, space } = useTheme();
  const router = useRouter();

  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);

  if (items.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: t.compare }} />
        <Screen>
          <Empty
            icon="git-compare-outline"
            title={t.compareEmpty}
            body={t.compareEmptyBody}
            onRetry={() => router.push("/products")}
            actionLabel={t.wishBrowse}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t.compare }} />
      <Screen scroll={false}>
        <VStack gap="md" style={{ flex: 1 }}>
          <Row justify="space-between">
            <Txt variant="label" tone="faint">
              {num(items.length)} / {num(4)}
            </Txt>
            <Pressable onPress={clear} hitSlop={8}>
              <Row gap="xs">
                <Ionicons name="trash-outline" size={14} color={c.ink400} />
                <Txt variant="label" tone="faint">
                  {t.clearAll}
                </Txt>
              </Row>
            </Pressable>
          </Row>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* A plain row, not `<Row>`: the columns must sit flush against the
                label strip, and every gap in the scale is wider than zero. */}
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              {/* Fixed labels. Outside the horizontal scroller on purpose: a
                  row of figures with its label scrolled off is unreadable. */}
              <View style={{ width: LABELS }}>
                <Cell height={COL + 8} />
                <LabelCell text={t.compareProduct} />
                <LabelCell text={t.comparePrice} />
                <LabelCell text={t.compareRating} />
                <LabelCell text={t.compareSeller} />
                <LabelCell text={t.compareStock} />
                <Cell height={56} />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: space.xxl }}
              >
                {items.map((product) => (
                  <Column key={product.slug} product={product} onRemove={() => remove(product.slug)} />
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </VStack>
      </Screen>
    </>
  );
}

function Column({ product, onRemove }: { product: ProductCard; onRemove: () => void }) {
  const t = dict();
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const add = useCart((s) => s.add);

  const stock = Number(product.stock_qty) || 0;

  const open = () => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } });

  return (
    <View style={{ width: COL, borderStartWidth: 1, borderStartColor: c.line }}>
      <Cell height={COL + 8}>
        <View>
          <Pressable onPress={open}>
            <Image
              source={product.image}
              style={{
                width: COL - space.md * 2,
                height: COL - space.md * 2,
                borderRadius: radius.lg,
                backgroundColor: c.blue050,
              }}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            style={{
              position: "absolute",
              top: 2,
              end: 2,
              backgroundColor: c.surface,
              borderRadius: radius.pill,
              padding: 3,
            }}
          >
            <Ionicons name="close" size={13} color={c.ink600} />
          </Pressable>
        </View>
      </Cell>

      <Cell>
        <Pressable onPress={open}>
          <Txt variant="label" numberOfLines={2}>
            {product.title}
          </Txt>
        </Pressable>
      </Cell>

      <Cell>
        <VStack gap="xs">
          <Txt variant="label" tone="blue">
            {money(product.price)}
          </Txt>
          {!!product.compare_at_price && product.compare_at_price > product.price && (
            <Txt variant="caption" tone="faint" style={{ textDecorationLine: "line-through" }}>
              {money(product.compare_at_price)}
            </Txt>
          )}
        </VStack>
      </Cell>

      <Cell>
        {(product.review_count ?? 0) > 0 ? (
          <Row gap="xs">
            <Ionicons name="star" size={12} color={c.gold} />
            <Txt variant="caption">{num(product.rating ?? 0, { decimals: 1 })}</Txt>
            <Txt variant="caption" tone="faint">
              ({num(product.review_count ?? 0)})
            </Txt>
          </Row>
        ) : (
          <Txt variant="caption" tone="faint">
            —
          </Txt>
        )}
      </Cell>

      <Cell>
        <Txt variant="caption" tone="muted" numberOfLines={2}>
          {product.vendor_name || "—"}
        </Txt>
      </Cell>

      <Cell>
        <Txt variant="caption" tone={stock > 0 ? "mint" : "coral"}>
          {stock > 0 ? t.compareInStock : t.outOfStock}
        </Txt>
      </Cell>

      <Cell height={56}>
        {/* A product with options cannot be added from here — which option? The
            web sends those to the product page too, rather than guessing. */}
        {product.has_variants ? (
          <PrimaryButton label={t.compareChoose} onPress={open} small />
        ) : (
          <PrimaryButton
            label={t.addToCart}
            small
            disabled={stock <= 0}
            onPress={() =>
              add({
                slug: product.slug,
                title: product.title,
                price: product.price,
                qty: 1,
                image: product.image,
                vendor_name: product.vendor_name,
                stock_qty: stock,
              })
            }
          />
        )}
      </Cell>
    </View>
  );
}

function Cell({ children, height }: { children?: ReactNode; height?: number }) {
  const { c, space } = useTheme();
  return (
    <View
      style={{
        height: height ?? 62,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        justifyContent: "center",
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      {children}
    </View>
  );
}

function LabelCell({ text }: { text: string }) {
  return (
    <Cell>
      <Txt variant="caption" tone="faint">
        {text}
      </Txt>
    </Cell>
  );
}
