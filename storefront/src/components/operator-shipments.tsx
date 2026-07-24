"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, PackagePlus, Truck } from "lucide-react";
import {
  createOrderShipments,
  getOperatorOrderShipments,
  SHIPMENT_STATUSES,
  shipmentStatusLabel,
  updateShipmentStatus,
  type Shipment,
} from "@/lib/shipments-api";
import { useI18n } from "@/components/i18n-provider";

/** Operator control panel for an order's shipments: create one per vendor
 * sub-order, then advance each status (logs a tracking event). */
export function OperatorShipments({ order }: { order: string }) {
  const { t } = useI18n();
  const msg = (e: unknown) => (e instanceof Error ? e.message : t.vshError);
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOperatorOrderShipments(order).then((s) => !cancelled && setShipments(s));
    return () => {
      cancelled = true;
    };
  }, [order]);

  async function create() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await createOrderShipments(order);
      const s = await getOperatorOrderShipments(order);
      setShipments(s);
      if (!s.length) setNote(t.oshNoVendorOrders);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(name: string, status: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateShipmentStatus(name, status);
      setShipments((prev) => (prev ?? []).map((s) => (s.name === name ? updated : s)));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  if (shipments === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> {t.vshLoading}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          <Truck className="h-4 w-4" /> {t.vendorNavShipments}
        </div>
        {shipments.length === 0 && (
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="btn btn-ghost h-8 px-3 text-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            {t.oshCreateAll}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {note && <p className="text-sm text-ink-400">{note}</p>}

      {shipments.length > 0 && (
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {shipments.map((s) => (
            <div key={s.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate text-ink">{s.vendor_name || s.vendor || "—"}</div>
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <span>{s.carrier || s.provider}</span>
                  {s.tracking_number && (
                    <span className="font-tech" dir="ltr">
                      {s.tracking_number}
                    </span>
                  )}
                  {s.tracking_url && (
                    <a
                      href={s.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                    >
                      {t.vshTrack} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <select
                value={s.status}
                disabled={busy}
                onChange={(e) => setStatus(s.name, e.target.value)}
                className="h-8 rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-blue disabled:opacity-50"
              >
                {!(SHIPMENT_STATUSES as readonly string[]).includes(s.status) && (
                  <option value={s.status}>{shipmentStatusLabel(t, s.status)}</option>
                )}
                {SHIPMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {shipmentStatusLabel(t, st)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
