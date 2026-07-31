import type { ProductCard as Card } from "@ovira/core";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { dict, fill, num } from "../i18n";
import { useTheme } from "../theme-context";
import { Price } from "./price";
import { Rating } from "./rating";
import { Txt } from "./ui";

/**
 * One product tile.
 *
 * The stock line is deliberately three states rather than two. "Out of stock"
 * and "48 available" are the easy ones; "only 3 left" is the one that actually
 * moves a decision, and hiding it behind the same neutral grey as a healthy
 * count wastes the only urgency this store has that is truthful.
 */
export function ProductTile({ product, width }: { product: Card; width?: number }) {
  const { c, space, radius, shadow } = useTheme();
  const t = dict();
  const stock = Number(product.stock_qty) || 0;
  const low = stock > 0 && stock <= 5;

  return (
    <Link href={{ pathname: "/product/[slug]", params: { slug: product.slug } }} asChild>
      <Pressable style={{ width }}>
        {({ pressed }) => (
          <View
            style={[
              {
                backgroundColor: c.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: c.line,
                overflow: "hidden",
                opacity: pressed ? 0.85 : 1,
              },
              shadow(1),
            ]}
          >
            <View>
              <Image
                source={product.image}
                style={{ width: "100%", aspectRatio: 1, backgroundColor: c.blue050 }}
                contentFit="cover"
                transition={180}
              />
              {stock <= 0 && (
                // Drawn over the image rather than under the title: a shopper
                // decides from the picture, and finding out at the bottom of the
                // card is finding out too late.
                <View
                  style={[
                    { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
                    {
                      backgroundColor: "rgba(11,31,56,0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Txt variant="label" tone="onBlue">
                    {t.outOfStock}
                  </Txt>
                </View>
              )}
            </View>

            <View style={{ padding: space.md, gap: space.xs }}>
              <Txt variant="label" numberOfLines={2} style={{ minHeight: 40 }}>
                {product.title}
              </Txt>

              <Price price={product.price} compareAt={product.compare_at_price} />

              {(product.review_count ?? 0) > 0 && (
                <Rating value={product.rating} count={product.review_count} />
              )}

              {stock > 0 && (
                <Txt variant="caption" tone={low ? "coral" : "faint"}>
                  {low ? fill(t.lowStock, { n: num(stock) }) : fill(t.inStock, { n: num(stock) })}
                </Txt>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}
