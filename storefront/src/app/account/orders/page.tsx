"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Package } from "lucide-react";
import {
  getMyOrders,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  type BuyerOrderSummary,
} from "@/lib/orders-api";
import { useI18n } from "@/components/i18n-provider";
import { cn, formatPrice } from "@/lib/utils";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

export default function OrdersPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<BuyerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="py-8">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Package className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.odlEmptyTitle}</h1>
          <p className="text-sm text-ink-400">{t.odlEmptyHint}</p>
          <Link href="/" className="btn btn-primary inline-flex">{t.coStartShopping}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium text-ink">{t.myOrders} ({orders.length})</h1>
      <div className="space-y-3">
        {orders.map((o) => (
          <Link key={o.name} href={`/account/orders/${o.name}`} className="card block p-4 transition-shadow hover:shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-tech font-medium text-ink">{o.name}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", ORDER_STATUS_STYLE[o.status])}>
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </div>
              <span className="text-sm text-ink-400">{formatDate(o.creation)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-ink-400">{o.item_count} {t.ordItemsCount}</span>
              <div className="flex items-center gap-1 text-blue-600">
                <span className="font-tech font-medium text-ink">{formatPrice(o.total, o.currency)}</span>
                <ChevronLeft className="h-4 w-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
