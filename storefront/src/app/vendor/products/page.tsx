"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Package, Pencil, Plus, Trash2 } from "lucide-react";
import {
  APPROVAL_LABEL,
  APPROVAL_STYLE,
  deleteProduct,
  getMyProducts,
  type VendorProduct,
} from "@/lib/vendor";
import { cn, formatPrice } from "@/lib/utils";

const LOW_STOCK = 5;

export default function VendorProductsPage() {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  const lowCount = products.filter((p) => p.stock_qty <= LOW_STOCK).length;
  const shown = lowOnly ? products.filter((p) => p.stock_qty <= LOW_STOCK) : products;

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
        <div className="flex flex-wrap gap-2">
          {lowCount > 0 && (
            <button
              type="button"
              onClick={() => setLowOnly((v) => !v)}
              aria-pressed={lowOnly}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors",
                lowOnly ? "border-gold bg-gold/10 text-gold" : "border-line text-ink-600 hover:border-gold",
              )}
            >
              <AlertTriangle className="h-4 w-4" /> مخزون منخفض ({lowCount})
            </button>
          )}
          <Link href="/vendor/products/import" className="btn btn-ghost">
            <FileUp className="h-4 w-4" /> استيراد CSV
          </Link>
          <Link href="/vendor/products/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> أضف منتج
          </Link>
        </div>
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
            {shown.map((p) => (
              <div key={p.name} className="flex items-center gap-3 p-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-blue-50">
                  {p.image && <Image src={p.image} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <div className="min-w-0 grow">
                  <div className="truncate text-sm text-ink">{p.title}</div>
                  <div className="font-tech text-xs text-ink-400">{p.name}</div>
                </div>
                <span className="hidden font-tech text-sm text-ink sm:block">{formatPrice(p.price, p.currency)}</span>
                <span
                  className={cn(
                    "hidden w-24 text-center text-xs md:block",
                    p.stock_qty <= 0 ? "text-coral" : p.stock_qty <= LOW_STOCK ? "text-gold" : "text-ink-400",
                  )}
                >
                  {p.stock_qty <= 0
                    ? "نفد المخزون"
                    : p.stock_qty <= LOW_STOCK
                      ? `منخفض: ${p.stock_qty}`
                      : `${p.stock_qty} قطعة`}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", APPROVAL_STYLE[p.approval_status])}>
                  {APPROVAL_LABEL[p.approval_status]}
                </span>
                <Link
                  href={`/vendor/products/new?id=${encodeURIComponent(p.name)}`}
                  aria-label="تعديل المنتج"
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
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
