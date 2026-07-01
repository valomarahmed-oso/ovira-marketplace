"use client";

import { useEffect, useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { getMyOrders, type VendorOrder } from "@/lib/vendor";
import { cn, formatPrice } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  "Pending Payment": "bg-[#f1efe8] text-ink-600",
  Paid: "bg-blue-50 text-blue-600",
  Processing: "bg-[#fdf2dd] text-[#854f0b]",
  Shipped: "bg-[#fdf2dd] text-[#854f0b]",
  Completed: "bg-[#e7f8f1] text-mint",
  Cancelled: "bg-coral-50 text-coral",
};

const STATUS_LABEL: Record<string, string> = {
  "Pending Payment": "بانتظار الدفع",
  Paid: "مدفوع",
  Processing: "قيد التجهيز",
  Shipped: "تم الشحن",
  Completed: "مكتمل",
  Cancelled: "ملغي",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-ink">الطلبات ({orders.length})</h1>

      {orders.length === 0 ? (
        <div className="card space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <ShoppingBag className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-ink-400">لسه مفيش طلبات على منتجاتك.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1.2fr_1.5fr_0.8fr_1fr_1fr] gap-3 border-b border-line p-4 text-xs text-ink-400 md:grid">
            <span>رقم الطلب</span>
            <span>العميل</span>
            <span>المنتجات</span>
            <span>نصيبك</span>
            <span>الحالة</span>
          </div>
          <div className="divide-y divide-line">
            {orders.map((o) => (
              <div key={o.name} className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-[1.2fr_1.5fr_0.8fr_1fr_1fr] md:items-center">
                <span className="font-tech font-medium text-ink">{o.name}</span>
                <span className="text-ink-600">
                  {o.customer_name || "—"}
                  <span className="block text-xs text-ink-400">{formatDate(o.creation)}</span>
                </span>
                <span className="text-ink-400">{o.item_count} منتج</span>
                <span className="font-tech text-ink">{formatPrice(o.vendor_total, o.currency)}</span>
                <span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_STYLE[o.status] ?? "bg-blue-50 text-blue-600")}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
