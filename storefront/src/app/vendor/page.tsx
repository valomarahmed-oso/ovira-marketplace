"use client";

import Image from "next/image";
import Link from "next/link";
import { Package, Plus, ShoppingBag, Star, TrendingUp } from "lucide-react";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_STYLE,
  useVendor,
} from "@/lib/vendor-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, formatPrice } from "@/lib/utils";

export default function VendorOverview() {
  const products = useVendor((s) => s.products);
  const hydrated = useHydrated();

  if (!hydrated) {
    return <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>;
  }

  const pending = products.filter((p) => p.status === "Pending").length;

  const stats = [
    { label: "مبيعات الشهر", value: formatPrice(124500), icon: TrendingUp, hint: "+12% عن الشهر اللي فات" },
    { label: "الطلبات", value: "٨٦", icon: ShoppingBag, hint: "٧ طلبات جديدة" },
    { label: "المنتجات", value: String(products.length), icon: Package, hint: `${pending} بانتظار المراجعة` },
    { label: "تقييم المتجر", value: "٤٫٨", icon: Star, hint: "٢٦٣ تقييم" },
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
        <div className="divide-y divide-line">
          {products.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-blue-50">
                {p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}
              </span>
              <div className="min-w-0 grow">
                <div className="truncate text-sm text-ink">{p.title}</div>
                <div className="text-xs text-ink-400">{p.category}</div>
              </div>
              <span className="hidden font-tech text-sm text-ink sm:block">{formatPrice(p.price)}</span>
              <span className="hidden w-16 text-center text-xs text-ink-400 sm:block">
                {p.stock > 0 ? `${p.stock} قطعة` : "نفد"}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", PRODUCT_STATUS_STYLE[p.status])}>
                {PRODUCT_STATUS_LABEL[p.status]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
