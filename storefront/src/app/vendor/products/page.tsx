"use client";

import Image from "next/image";
import Link from "next/link";
import { Package, Plus, Trash2 } from "lucide-react";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_STYLE,
  useVendor,
} from "@/lib/vendor-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, formatPrice } from "@/lib/utils";

export default function VendorProductsPage() {
  const products = useVendor((s) => s.products);
  const removeProduct = useVendor((s) => s.removeProduct);
  const hydrated = useHydrated();

  if (!hydrated) {
    return <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">المنتجات ({products.length})</h1>
        <Link href="/vendor/products/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> أضف منتج
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="card space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Package className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-ink-400">لسه مفيش منتجات — أضف أول منتج لمتجرك.</p>
          <Link href="/vendor/products/new" className="btn btn-primary inline-flex">
            <Plus className="h-4 w-4" /> أضف منتج
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-line">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-blue-50">
                  {p.image && <Image src={p.image} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <div className="min-w-0 grow">
                  <div className="truncate text-sm text-ink">{p.title}</div>
                  <div className="font-tech text-xs text-ink-400">{p.id}</div>
                </div>
                <span className="hidden font-tech text-sm text-ink sm:block">{formatPrice(p.price)}</span>
                <span className="hidden w-20 text-center text-xs text-ink-400 md:block">
                  {p.stock > 0 ? `${p.stock} قطعة` : "نفد المخزون"}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", PRODUCT_STATUS_STYLE[p.status])}>
                  {PRODUCT_STATUS_LABEL[p.status]}
                </span>
                <button
                  type="button"
                  onClick={() => removeProduct(p.id)}
                  aria-label="حذف المنتج"
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
