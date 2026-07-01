"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Loader2, Package, Plus, ShoppingBag, TrendingUp } from "lucide-react";
import {
  APPROVAL_LABEL,
  APPROVAL_STYLE,
  getMyOrders,
  getMyProducts,
  type VendorOrder,
  type VendorProduct,
} from "@/lib/vendor";
import { cn, formatPrice } from "@/lib/utils";

export default function VendorOverview() {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyProducts(), getMyOrders()])
      .then(([p, o]) => {
        setProducts(p);
        setOrders(o);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
      </div>
    );
  }

  const pending = products.filter((p) => p.approval_status === "Pending").length;
  const revenue = orders.reduce((sum, o) => sum + (o.vendor_total || 0), 0);

  const stats = [
    { label: "إجمالي المبيعات", value: formatPrice(revenue), icon: TrendingUp, hint: `${orders.length} طلب` },
    { label: "الطلبات", value: String(orders.length), icon: ShoppingBag, hint: "كل الطلبات" },
    { label: "المنتجات", value: String(products.length), icon: Package, hint: `${pending} بانتظار المراجعة` },
    { label: "بانتظار المراجعة", value: String(pending), icon: Clock, hint: "منتجات غير منشورة" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">نظرة عامة</h1>
        <Link href="/vendor/products/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> أضف منتج
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-400">{s.label}</span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50">
                <s.icon className="h-4 w-4 text-blue-600" />
              </span>
            </div>
            <div className="mt-3 font-tech text-2xl font-medium text-ink">{s.value}</div>
            <div className="mt-1 text-xs text-ink-400">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-medium text-ink">أحدث المنتجات</h2>
          <Link href="/vendor/products" className="text-sm text-blue-600 hover:underline">
            عرض الكل
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-400">لسه مفيش منتجات.</div>
        ) : (
          <div className="divide-y divide-line">
            {products.slice(0, 5).map((p) => (
              <div key={p.name} className="flex items-center gap-3 p-3">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-blue-50">
                  {p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}
                </span>
                <div className="min-w-0 grow">
                  <div className="truncate text-sm text-ink">{p.title}</div>
                  <div className="text-xs text-ink-400">{p.category_name ?? "—"}</div>
                </div>
                <span className="hidden font-tech text-sm text-ink sm:block">{formatPrice(p.price, p.currency)}</span>
                <span className="hidden w-16 text-center text-xs text-ink-400 sm:block">
                  {p.stock_qty > 0 ? `${p.stock_qty} قطعة` : "نفد"}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", APPROVAL_STYLE[p.approval_status])}>
                  {APPROVAL_LABEL[p.approval_status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
