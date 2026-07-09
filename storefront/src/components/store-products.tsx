"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Package, Search } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { getProducts, type Product } from "@/lib/api";
import { getDict, type Locale } from "@/lib/i18n";

/** A store's product grid with live, debounced search scoped to that vendor.
 *  The initial grid is server-rendered; typing re-queries within the store. */
export function StoreProducts({
  initialProducts,
  vendor,
  locale,
}: {
  initialProducts: Product[];
  vendor: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The SSR grid already covers the empty query, so skip the mount fetch.
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        setProducts(await getProducts({ vendor, search: q || undefined, limit: 48 }));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, vendor]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-ink">{t.storeProductsHeading}</h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.productSearch}
            aria-label={t.productSearch}
            className="h-11 w-full rounded-xl border border-line bg-white ps-9 pe-4 text-sm outline-none focus:border-blue"
          />
          {loading && (
            <Loader2 className="absolute inset-y-0 end-3 my-auto h-4 w-4 animate-spin text-blue-600" />
          )}
        </div>
      </div>

      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-ink-400">
          <Package className="h-8 w-8" />
          <p>{query.trim() ? t.storeSearchNoMatch : t.storeNoProducts}</p>
        </div>
      )}
    </div>
  );
}
