"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import type { Product } from "@/lib/api";
import { ProductCard } from "@/components/product-card";
import { getSponsoredProducts, recordSponsoredClick } from "@/lib/sponsored-api";
import { useI18n } from "@/components/i18n-provider";

/** A labelled row of promoted products above a catalog listing. Renders nothing
 *  when there are no live placements, so it's safe to drop on any listing page.
 *  A click anywhere on a card is billed to its placement (fire-and-forget). */
export function SponsoredStrip({ category }: { category?: string }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let alive = true;
    getSponsoredProducts(category).then((p) => {
      if (alive) setItems(p);
    });
    return () => {
      alive = false;
    };
  }, [category]);

  if (!items.length) return null;

  return (
    <section aria-label={t.sponsoredHeading} className="space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-ink-500">
        <Megaphone className="h-4 w-4" />
        <span>{t.sponsoredHeading}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {items.map((p) => (
          <div
            key={p.name}
            onClickCapture={() => p.placement && recordSponsoredClick(p.placement)}
          >
            <ProductCard p={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
