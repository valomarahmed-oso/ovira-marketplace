"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { useWishlist } from "@/lib/wishlist-store";
import { useHydrated } from "@/lib/use-hydrated";

export default function WishlistPage() {
  const items = useWishlist((s) => s.items);
  const hydrated = useHydrated();

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
      <h1 className="text-2xl font-medium text-ink">المفضلة ({items.length})</h1>
      <ProductGrid products={items} />
    </div>
  );
}
