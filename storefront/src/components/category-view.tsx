"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Product } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";
import { formatPrice } from "@/lib/utils";

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

export function CategoryView({ products }: { products: Product[] }) {
  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[],
    [products],
  );
  const priceCap = useMemo(() => Math.max(...products.map((p) => p.price), 0), [products]);

  const [sort, setSort] = useState<Sort>("featured");
  const [inStock, setInStock] = useState(false);
  const [maxPrice, setMaxPrice] = useState(priceCap);
  const [selBrands, setSelBrands] = useState<string[]>([]);

  const view = useMemo(() => {
    let list = products.filter((p) => p.price <= maxPrice);
    if (inStock) list = list.filter((p) => p.stock_qty > 0);
    if (selBrands.length) list = list.filter((p) => p.brand && selBrands.includes(p.brand));
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list;
  }, [products, maxPrice, inStock, selBrands, sort]);

  function toggleBrand(b: string) {
    setSelBrands((s) => (s.includes(b) ? s.filter((x) => x !== b) : [...s, b]));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="card h-fit space-y-6 p-5">
        <div className="flex items-center gap-2 font-medium text-ink">
          <SlidersHorizontal className="h-4 w-4 text-blue-600" /> تصفية
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-ink">السعر الأقصى</div>
          <input
            type="range"
            min={0}
            max={priceCap}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full accent-blue"
            aria-label="السعر الأقصى"
          />
          <div className="font-tech text-sm text-ink-600">حتى {formatPrice(maxPrice)}</div>
        </div>

        {brands.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-ink">الماركة</div>
            {brands.map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
                <input type="checkbox" checked={selBrands.includes(b)} onChange={() => toggleBrand(b)} className="accent-blue" />
                {b}
              </label>
            ))}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="accent-blue" />
          المتوفر فقط
        </label>
      </aside>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-400">{view.length} منتج</span>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-400">ترتيب:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            >
              <option value="featured">المميّزة</option>
              <option value="price-asc">السعر: من الأقل</option>
              <option value="price-desc">السعر: من الأعلى</option>
              <option value="rating">الأعلى تقييمًا</option>
            </select>
          </label>
        </div>

        {view.length ? (
          <ProductGrid products={view} />
        ) : (
          <div className="card p-10 text-center text-ink-400">لا توجد منتجات مطابقة للتصفية</div>
        )}
      </div>
    </div>
  );
}
