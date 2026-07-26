"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { getShippingRate } from "@/lib/api";
import { getShippingRates } from "@/lib/shipping-rates-api";
import { GOVERNORATES } from "@/lib/addresses-api";
import { useI18n } from "@/components/i18n-provider";
import { useMoney } from "@/lib/currency";

/** Lets a shopper see the shipping fee + ETA to their governorate before they
 *  commit to checkout. Reuses the same public rate endpoints as checkout. */
export function DeliveryEstimate({ price, currency }: { price: number; currency?: string }) {
  const { t } = useI18n();
  const { money } = useMoney();
  const [gov, setGov] = useState(GOVERNORATES[0]);
  const [fee, setFee] = useState<number | null>(null);
  const [eta, setEta] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getShippingRates().then((rates) => {
      const map: Record<string, number> = {};
      for (const r of rates) if (r.eta_days) map[r.governorate] = r.eta_days;
      setEta(map);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getShippingRate(price, gov).then((f) => {
      if (!cancelled) {
        setFee(f);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [price, gov]);

  const days = eta[gov];

  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium text-ink">
        <Truck className="h-4 w-4 text-blue-600" /> {t.deTitle}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={gov}
          onChange={(e) => setGov(e.target.value)}
          aria-label={t.deGov}
          className="h-9 rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-blue"
        >
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="text-ink-600">
          {loading ? (
            "…"
          ) : fee === 0 ? (
            <span className="text-mint">{t.deFreeShip}</span>
          ) : fee != null ? (
            <>{t.deShipFee} {money(fee)}</>
          ) : (
            ""
          )}
          {days ? ` · ${t.deEta.replace("{n}", String(days))}` : ""}
        </span>
      </div>
    </div>
  );
}
