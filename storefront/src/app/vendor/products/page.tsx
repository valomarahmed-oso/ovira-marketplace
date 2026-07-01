"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import {
  APPROVAL_LABEL,
  APPROVAL_STYLE,
  deleteProduct,
  getMyProducts,
  type VendorProduct,
} from "@/lib/vendor";
import { cn, formatPrice } from "@/lib/utils";

export default function VendorProductsPage() {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    getMyProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  async function remove(name: string) {
    setRemoving(name);
    try {
      await deleteProduct(name);
      setProducts((list) => list.filter((p) => p.name !== name));
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
      </div>
    );
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
              <div key={p.name} className="flex items-center gap-3 p-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-blue-50">
                  {p.image && <Image src={p.image} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <div className="min-w-0 grow">
                  <div className="truncate text-sm text-ink">{p.title}</div>
                  <div className="font-tech text-xs text-ink-400">{p.name}</div>
                </div>
                <span className="hidden font-tech text-sm text-ink sm:block">{formatPrice(p.price, p.currency)}</span>
                <span className="hidden w-20 text-center text-xs text-ink-400 md:block">
                  {p.stock_qty > 0 ? `${p.stock_qty} قطعة` : "نفد المخزون"}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", APPROVAL_STYLE[p.approval_status])}>
                  {APPROVAL_LABEL[p.approval_status]}
                </span>
                <button
                  type="button"
                  onClick={() => remove(p.name)}
                  disabled={removing === p.name}
                  aria-label="حذف المنتج"
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral disabled:opacity-50"
                >
                  {removing === p.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
