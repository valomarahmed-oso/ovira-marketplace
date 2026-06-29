"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Package } from "lucide-react";
import { ORDER_STATUS_LABEL, type OrderStatus, useOrders } from "@/lib/orders-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, formatPrice } from "@/lib/utils";

const STATUS_STYLE: Record<OrderStatus, string> = {
  processing: "bg-blue-50 text-blue-600",
  shipped: "bg-[#fdf2dd] text-[#854f0b]",
  delivered: "bg-[#e7f8f1] text-mint",
  cancelled: "bg-coral-50 text-coral",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

export default function OrdersPage() {
  const orders = useOrders((s) => s.orders);
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="container-ovira py-10">
        <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Package className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">لا توجد طلبات بعد</h1>
          <p className="text-sm text-ink-400">أول ما تكمّل أول طلب هيظهر هنا.</p>
          <Link href="/" className="btn btn-primary inline-flex">ابدأ التسوّق</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-ovira space-y-5 py-6">
      <h1 className="text-2xl font-medium text-ink">طلباتي ({orders.length})</h1>
      <div className="space-y-3">
        {orders.map((o) => {
          const count = o.items.reduce((n, i) => n + i.qty, 0);
          return (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="card block p-4 transition-shadow hover:shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-tech font-medium text-ink">{o.id}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_STYLE[o.status])}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>
                <span className="text-sm text-ink-400">{formatDate(o.date)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  {o.items.slice(0, 3).map(({ product: p }) => (
                    <span key={p.slug} className="relative h-12 w-12 overflow-hidden rounded-lg border border-line bg-blue-50">
                      {p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}
                    </span>
                  ))}
                  <span className="ms-2 self-center text-xs text-ink-400">{count} منتج</span>
                </div>
                <div className="flex items-center gap-1 text-blue-600">
                  <span className="font-tech font-medium text-ink">{formatPrice(o.total)}</span>
                  <ChevronLeft className="h-4 w-4" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
