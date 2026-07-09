"use client";

import { useEffect, useState } from "react";
import { FileDown, Loader2, MessageCircle, ShoppingBag, Truck } from "lucide-react";
import { exportMyOrdersCsv, getMyOrders, getMyStore, type VendorOrder } from "@/lib/vendor";
import { getVendorShipmentStatuses, SHIPMENT_STATUS_LABEL } from "@/lib/shipments-api";
import { getVendorThreads } from "@/lib/messaging-api";
import { OrderChat } from "@/components/order-chat";
import { useI18n } from "@/components/i18n-provider";
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
  const { t } = useI18n();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [shipStatus, setShipStatus] = useState<Record<string, string>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [vendorCode, setVendorCode] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function onExport() {
    setExporting(true);
    try {
      await exportMyOrdersCsv();
    } catch {
      /* best-effort download */
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
    getVendorShipmentStatuses().then(setShipStatus);
    getMyStore().then((s) => setVendorCode(s?.name ?? null));
    getVendorThreads().then((rows) => {
      const map: Record<string, number> = {};
      for (const r of rows) map[r.order] = r.unread;
      setUnread(map);
    });
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">الطلبات ({orders.length})</h1>
        {orders.length > 0 && (
          <button type="button" onClick={onExport} disabled={exporting} className="btn btn-ghost disabled:opacity-40">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            تصدير CSV
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="card space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <ShoppingBag className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-ink-400">لسه مفيش طلبات على منتجاتك.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1.2fr_1.5fr_0.8fr_1fr_1fr_auto] gap-3 border-b border-line p-4 text-xs text-ink-400 md:grid">
            <span>رقم الطلب</span>
            <span>العميل</span>
            <span>المنتجات</span>
            <span>نصيبك</span>
            <span>الحالة</span>
            <span></span>
          </div>
          <div className="divide-y divide-line">
            {orders.map((o) => {
              const open = expanded === o.name;
              const n = unread[o.name] ?? 0;
              return (
                <div key={o.name}>
                  <div className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-[1.2fr_1.5fr_0.8fr_1fr_1fr_auto] md:items-center">
                    <span className="font-tech font-medium text-ink">{o.name}</span>
                    <span className="text-ink-600">
                      {o.customer_name || "—"}
                      <span className="block text-xs text-ink-400">{formatDate(o.creation)}</span>
                    </span>
                    <span className="text-ink-400">{o.item_count} منتج</span>
                    <span className="font-tech text-ink">{formatPrice(o.vendor_total, o.currency)}</span>
                    <span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          STATUS_STYLE[o.status] ?? "bg-blue-50 text-blue-600",
                        )}
                      >
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      {shipStatus[o.name] && (
                        <span className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                          <Truck className="h-3 w-3" />
                          {SHIPMENT_STATUS_LABEL[shipStatus[o.name]] ?? shipStatus[o.name]}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : o.name)}
                      className={cn(
                        "relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors",
                        open
                          ? "border-blue bg-blue text-white"
                          : "border-line text-ink-600 hover:border-blue",
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t.chatMessages}
                      {n > 0 && !open && (
                        <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-medium text-white">
                          {n}
                        </span>
                      )}
                    </button>
                  </div>
                  {open && vendorCode && (
                    <div className="border-t border-line bg-[#faf9f5] p-4">
                      <OrderChat order={o.name} vendor={vendorCode} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
