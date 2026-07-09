"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Heart, ShoppingCart } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { useWishlist } from "@/lib/wishlist-store";
import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";

export default function WishlistPage() {
  const items = useWishlist((s) => s.items);
  const add = useCart((s) => s.add);
  const hydrated = useHydrated();
  const [added, setAdded] = useState(false);

  // One-click adds only make sense for in-stock items that don't need a variant
  // choice — variant products still route through the product page.
  const addable = items.filter((p) => !p.has_variants && (p.stock_qty ?? 0) > 0);

  function addAll() {
    addable.forEach((p) => add(p, 1));
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  if (!hydrated) {
    return (
      <div className="container-ovira py-10">
        <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral-50">
            <Heart className="h-7 w-7 text-coral" />
          </div>
          <h1 className="text-xl font-medium text-ink">قائمة مفضّلتك فاضية</h1>
          <p className="text-sm text-ink-400">احفظ المنتجات اللي عجبتك بالضغط على القلب.</p>
          <Link href="/" className="btn btn-primary inline-flex">تصفّح المنتجات</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-ovira space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">المفضلة ({items.length})</h1>
        {addable.length > 0 && (
          <button type="button" onClick={addAll} className="btn btn-primary">
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {added ? "تمت الإضافة للسلة" : `أضف الكل للسلة (${addable.length})`}
          </button>
        )}
      </div>
      <ProductGrid products={items} />
    </div>
  );
}
