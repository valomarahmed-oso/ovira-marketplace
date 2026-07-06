"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";
import { SectionHeading } from "@/components/section-heading";
import { getRecommendedForYou } from "@/lib/recommendations-api";
import { useI18n } from "@/components/i18n-provider";

/** A personalised product strip, computed server-side from the shopper's
 *  purchase history (with a popular-products fallback). Renders nothing until
 *  there's something to show, so it's safe to drop on any page. */
export function RecommendedForYou({ limit = 8 }: { limit?: number }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let alive = true;
    getRecommendedForYou(limit).then((p) => {
      if (alive) setItems(p);
    });
    return () => {
      alive = false;
    };
  }, [limit]);

  if (!items.length) return null;

  return (
    <section>
      <SectionHeading title={t.recForYou} />
      <ProductGrid products={items} />
    </section>
  );
}
