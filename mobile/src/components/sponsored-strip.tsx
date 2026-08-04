import { recordSponsoredClick, sponsoredProducts, type SponsoredCard } from "@ovira/core";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView } from "react-native";

import { dict } from "../i18n";
import { useTheme } from "../theme-context";
import { ProductTile } from "./product-card";
import { Row, Txt, VStack } from "./ui";

/**
 * Paid placements for a listing.
 *
 * Two things are not optional here, and both are about honesty:
 *
 * - **It says it is paid for.** A shopper is entitled to know a position was
 *   bought rather than earned, and the tile carries the same tag the web does.
 * - **The tap is reported.** The operator bills per click, so a strip that
 *   renders without reporting shows ads nobody pays for. The beacon is
 *   fire-and-forget: billing must never delay opening the product, and a
 *   failed counter must never become an error a shopper sees.
 *
 * Renders nothing at all when there are no placements, which is the normal
 * state of a store that sells no advertising.
 */
export function SponsoredStrip({ category }: { category?: string }) {
  const t = dict();
  const { c, space } = useTheme();
  const [rows, setRows] = useState<SponsoredCard[]>([]);

  useEffect(() => {
    let alive = true;
    void sponsoredProducts(category, 8).then((found) => {
      if (alive) setRows(found);
    });
    return () => {
      alive = false;
    };
  }, [category]);

  if (!rows.length) return null;

  return (
    <VStack gap="md">
      <Row gap="xs">
        <Ionicons name="megaphone-outline" size={15} color={c.ink400} />
        <Txt variant="heading">{t.sponsoredHeading}</Txt>
      </Row>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.md, paddingBottom: space.xs }}
      >
        {rows.map((product) => (
          <Pressable
            key={`${product.name}-${product.placement ?? ""}`}
            onPress={() => {
              if (product.placement) recordSponsoredClick(product.placement);
            }}
          >
            {/* The tile is the tap target and navigates on its own; this
                wrapper only witnesses the tap for billing. */}
            <ProductTile product={product} width={158} sponsored />
          </Pressable>
        ))}
      </ScrollView>
    </VStack>
  );
}
