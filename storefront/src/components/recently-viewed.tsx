"use client";

import { useEffect } from "react";
import { ProductGrid } from "@/components/product-grid";
import { SectionHeading } from "@/components/section-heading";
import { useHydrated } from "@/lib/use-hydrated";
import { useRecentlyViewed, type ViewedProduct } from "@/lib/recently-viewed-store";

/** Records the current product into the recently-viewed store, and renders the
 * shopper's previously-viewed products (excluding this one). */
export function RecentlyViewed({ current }: { current: ViewedProduct }) {
  const record = useRecentlyViewed((s) => s.record);
  const items = useRecentlyViewed((s) => s.items);
  const hydrated = useHydrated();

  useEffect(() => {
    if (current.slug) record(current);
  }, [current.slug, record]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) return null;
  const others = items.filter((i) => i.slug !== current.slug).slice(0, 8);
  if (others.length === 0) return null;

  return (
    <section>
      <SectionHeading title="شوهدت مؤخرًا" />
      <ProductGrid products={others} />
    </section>
  );
}
