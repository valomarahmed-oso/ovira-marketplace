"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { TrustBadge } from "@/components/trust-badge";
import { getVendorTrust, type VendorTrust as VT } from "@/lib/trust-api";

/** Live seller-trust panel for the product page. Hides itself for stores with no
 *  track record yet (nothing to show, and we don't want to shame new sellers). */
export function VendorTrust({ vendor }: { vendor: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<VT | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVendorTrust(vendor).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [vendor]);

  if (!data || (data.orders === 0 && data.ratings_count === 0)) return null;

  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-700">{t.trustSectionTitle}</h3>
        <TrustBadge tier={data.tier} score={data.score} showScore />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <div className="flex items-center gap-1 font-medium text-ink">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            {data.rating > 0 ? data.rating.toFixed(1) : "—"}
          </div>
          <div className="text-xs text-ink-400">
            {data.ratings_count} {t.trustRatingsUnit}
          </div>
        </div>
        <div>
          <div className="font-medium text-ink">{pct(data.fulfillment_rate)}</div>
          <div className="text-xs text-ink-400">{t.trustFulfilment}</div>
        </div>
        <div>
          <div className="font-medium text-ink">{pct(data.return_rate)}</div>
          <div className="text-xs text-ink-400">{t.trustReturns}</div>
        </div>
        <div>
          <div className="font-medium tabular-nums text-ink">{data.orders}</div>
          <div className="text-xs text-ink-400">{t.trustOrders}</div>
        </div>
      </div>
    </div>
  );
}
