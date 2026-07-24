"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Truck } from "lucide-react";
import {
  getOrderTracking,
  shipmentStatusLabel,
  type Shipment,
} from "@/lib/shipments-api";
import { useI18n } from "@/components/i18n-provider";
import type { Dict } from "@/lib/i18n";

function StatusBadge({ status, t }: { status: string; t: Dict }) {
  const done = status === "Delivered";
  const bad = status === "Returned" || status === "Cancelled";
  return (
    <span
      className={
        "rounded-full px-2.5 py-0.5 text-xs font-medium " +
        (done ? "bg-mint/10 text-mint" : bad ? "bg-coral-50 text-coral" : "bg-blue-50 text-blue-600")
      }
    >
      {shipmentStatusLabel(t, status)}
    </span>
  );
}

/** Buyer-facing tracking timeline for one marketplace order. Renders nothing
 * until at least one shipment exists. */
export function ShipmentTracking({ order }: { order: string }) {
  const { t } = useI18n();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOrderTracking(order)
      .then((s) => !cancelled && setShipments(s))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [order]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-5 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!shipments.length) return null;

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2 font-medium text-ink">
        <Truck className="h-4 w-4 text-blue-600" /> {t.trkShipmentTitle}
      </div>

      {shipments.map((s) => {
        const events = [...(s.events ?? [])].reverse();
        return (
          <div key={s.name} className="space-y-3 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-ink-600">
                {s.vendor_name && <span className="text-ink">{s.vendor_name}</span>}
                {s.carrier && <span className="ms-2 text-xs text-ink-400">{s.carrier}</span>}
                {s.tracking_number && (
                  <span className="ms-2 font-tech text-xs text-ink-400" dir="ltr">
                    {s.tracking_number}
                  </span>
                )}
              </div>
              <StatusBadge status={s.status} t={t} />
            </div>

            {s.tracking_url && (
              <a
                href={s.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                {t.trkTrackAtCarrier} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {events.length > 0 ? (
              <ol className="space-y-3">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="relative mt-1 flex flex-col items-center">
                      <span className={"h-2.5 w-2.5 rounded-full " + (i === 0 ? "bg-blue" : "bg-line")} />
                      {i < events.length - 1 && <span className="mt-1 w-px grow bg-line" />}
                    </span>
                    <div className="pb-1">
                      <div className="text-sm text-ink">
                        {e.status ? shipmentStatusLabel(t, e.status) : e.description}
                      </div>
                      {e.description && e.status && e.description !== e.status && (
                        <div className="text-xs text-ink-400">{e.description}</div>
                      )}
                      <div className="text-xs text-ink-400">
                        {[e.location, e.posted_at?.slice(0, 16)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-400">{t.vshNoUpdates}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
