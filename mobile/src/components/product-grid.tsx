import type { ProductCard, SuggestedProduct } from "@ovira/core";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, useWindowDimensions, View } from "react-native";

import { dict, money } from "../i18n";
import { useTheme } from "../theme-context";
import { ProductTile } from "./product-card";
import { Empty } from "./states";
import { Txt } from "./ui";

/**
 * The catalogue grid.
 *
 * Columns are derived from the viewport instead of pinned to two, so a tile
 * keeps its proportions on a 5" Android phone and on a tablet rather than
 * stretching into a letterbox on one of them.
 */
export function ProductGrid({ products }: { products: ProductCard[] }) {
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const t = dict();

  if (!products.length) return <Empty title={t.noResults} body={t.noResultsBody} />;

  const columns = width >= 700 ? 3 : 2;
  const tile = (width - space.lg * 2 - space.md * (columns - 1)) / columns;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
      {products.map((p) => (
        <ProductTile key={p.name} product={p} width={tile} />
      ))}
    </View>
  );
}

/**
 * A type-ahead hit.
 *
 * Rendered as a row, not a tile, because the suggestion payload has no stock
 * figure and a tile would have to invent one. A row shows exactly what the
 * endpoint returned and nothing it didn't.
 */
export function SuggestionRow({ product }: { product: SuggestedProduct }) {
  const { c, space, radius } = useTheme();
  return (
    <Link href={{ pathname: "/product/[slug]", params: { slug: product.slug } }} asChild>
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.sm,
        }}
      >
        <Image
          source={product.image}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: c.blue050,
          }}
          contentFit="cover"
          transition={140}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="label" numberOfLines={1}>
            {product.title}
          </Txt>
          <Txt variant="caption" tone="blue">
            {money(product.price)}
          </Txt>
        </View>
      </Pressable>
    </Link>
  );
}
