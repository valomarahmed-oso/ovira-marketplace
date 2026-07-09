"use client";

import { useEffect, useState } from "react";
import { Clock, Package, Store } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { productStatusCounts, vendorStatusCounts } from "@/lib/operator";

/** At-a-glance operator KPIs on the admin landing — reuses the moderation-queue
 *  counts so nothing new is computed. Pending cards go gold when non-zero. */
export function OperatorStats() {
  const { t } = useI18n();
  const [pc, setPc] = useState<Record<string, number>>({});
  const [vc, setVc] = useState<Record<string, number>>({});

  useEffect(() => {
    productStatusCounts()
      .then(setPc)
      .catch(() => {});
    vendorStatusCounts()
      .then(setVc)
      .catch(() => {});
  }, []);

  const cards = [
    { label: t.statPendingProducts, value: pc.Pending ?? 0, icon: Clock, urgent: (pc.Pending ?? 0) > 0 },
    { label: t.statPendingVendors, value: vc.Pending ?? 0, icon: Clock, urgent: (vc.Pending ?? 0) > 0 },
    { label: t.statTotalProducts, value: pc.All ?? 0, icon: Package, urgent: false },
    { label: t.statTotalVendors, value: vc.All ?? 0, icon: Store, urgent: false },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={`card flex items-center gap-3 p-4 ${c.urgent ? "border-gold" : ""}`}>
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              c.urgent ? "bg-gold/10 text-gold" : "bg-blue-50 text-blue-600"
            }`}
          >
            <c.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-tech text-xl font-medium text-ink">{c.value}</div>
            <div className="text-xs text-ink-400">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
