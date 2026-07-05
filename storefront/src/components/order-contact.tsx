"use client";

import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { OrderChat } from "@/components/order-chat";
import { getOrderVendors, type OrderVendor } from "@/lib/messaging-api";

/** Buyer-side entry point on the order detail page: pick which vendor on the
 *  order to talk to (auto-selected when there's only one), then chat. */
export function OrderContact({ order }: { order: string }) {
  const { t } = useI18n();
  const [vendors, setVendors] = useState<OrderVendor[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    getOrderVendors(order).then((v) => {
      setVendors(v);
      if (v.length === 1) setActive(v[0].vendor);
    });
  }, [order]);

  if (!vendors.length) return null;

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2 font-medium text-ink">
        <MessagesSquare className="h-4 w-4 text-blue-600" /> {t.chatContactSeller}
      </div>

      {vendors.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {vendors.map((v) => (
            <button
              key={v.vendor}
              type="button"
              onClick={() => setActive(v.vendor)}
              className={`relative rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active === v.vendor
                  ? "border-blue bg-blue text-white"
                  : "border-line bg-white text-ink-600 hover:border-blue"
              }`}
            >
              {v.vendor_name}
              {v.unread > 0 && active !== v.vendor && (
                <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-medium text-white">
                  {v.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {active && <OrderChat key={active} order={order} vendor={active} />}
    </div>
  );
}
