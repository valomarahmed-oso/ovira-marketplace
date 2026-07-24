"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Package, Truck } from "lucide-react";
import { getMyOrders, type VendorOrder } from "@/lib/vendor";
import { getVendorShipmentStatuses } from "@/lib/shipments-api";
import { VendorShipments } from "@/components/vendor-shipments";
import { useI18n } from "@/components/i18n-provider";
import { cn, formatPrice } from "@/lib/utils";

// Orders the vendor can actually fulfil (paid → not yet finished/cancelled).
const SHIPPABLE = new Set(["Paid", "Processing", "Shipped", "Completed"]);

type Bucket = "all" | "toship" | "transit" | "delivered";

function bucketOf(shipStatus: string | undefined): Exclude<Bucket, "all"> {
  if (!shipStatus || shipStatus === "Draft" || shipStatus === "Created") return "toship";
  if (shipStatus === "Picked Up" || shipStatus === "In Transit") return "transit";
  return "delivered"; // Delivered / Returned / Cancelled
}

export default function VendorShipmentsPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [shipStatus, setShipStatus] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Bucket>("all");
  const [loading, setLoading] = useState(true);

  function refreshStatuses() {
    getVendorShipmentStatuses().then(setShipStatus);
  }

  useEffect(() => {
    getMyOrders()
      .then((rows) => setOrders(rows.filter((o) => SHIPPABLE.has(o.status))))
      .finally(() => setLoading(false));
    refreshStatuses();
  }, []);

  const statusLabel: Record<string, string> = {
    "Pending Payment": t.ostPendingPayment,
    Paid: t.ostPaid,
    Processing: t.ostProcessing,
    Shipped: t.ostShipped,
    Completed: t.ostCompleted,
    Cancelled: t.ostCancelled,
  };

  const counts = useMemo(() => {
    const c = { all: orders.length, toship: 0, transit: 0, delivered: 0 };
    for (const o of orders) c[bucketOf(shipStatus[o.name])]++;
    return c;
  }, [orders, shipStatus]);

  const visible = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => bucketOf(shipStatus[o.name]) === filter)),
    [orders, shipStatus, filter],
  );

  const tabs: { key: Bucket; label: string; n: number }[] = [
    { key: "all", label: t.vshFilterAll, n: counts.all },
    { key: "toship", label: t.vshFilterToShip, n: counts.toship },
    { key: "transit", label: t.vshFilterInTransit, n: counts.transit },
    { key: "delivered", label: t.vshFilterDelivered, n: counts.delivered },
  ];

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-medium text-ink">
          <Truck className="h-6 w-6 text-blue-600" /> {t.vshTitle}
        </h1>
        <p className="mt-1 text-sm text-ink-400">{t.vshSubtitle}</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t.vshNeutralNote}</span>
      </div>

      {orders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                filter === tab.key
                  ? "border-blue bg-blue text-white"
                  : "border-line text-ink-600 hover:border-blue",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  filter === tab.key ? "bg-white/20" : "bg-[#f1efe8] text-ink-400",
                )}
              >
                {tab.n}
              </span>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="card space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Package className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-ink-400">{t.vshEmpty}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((o) => (
            <div key={o.name} className="card space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-tech font-medium text-ink">{o.name}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {statusLabel[o.status] ?? o.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-ink-400">
                    {o.customer_name || "—"} · {o.item_count} {t.ordItemsCount}
                  </div>
                </div>
                <span className="font-tech text-sm text-ink">
                  {formatPrice(o.vendor_total, o.currency)}
                </span>
              </div>
              <div className="border-t border-line pt-4">
                <VendorShipments order={o.name} onChange={refreshStatuses} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
