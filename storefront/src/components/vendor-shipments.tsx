"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, ExternalLink, Loader2, PackagePlus, Printer, Save, Truck } from "lucide-react";
import {
  createMyShipment,
  getMyOrderShipments,
  listCarriers,
  SHIPMENT_STATUSES,
  shipmentStatusLabel,
  updateMyShipment,
  type Carrier,
  type Shipment,
} from "@/lib/shipments-api";
import { useI18n } from "@/components/i18n-provider";

type Draft = { carrier: string; tracking_number: string; tracking_url: string };

/** Vendor fulfilment panel for their own sub-order of a marketplace order: the
 * vendor creates the shipment for the items they sold, records the courier they
 * chose (the marketplace runs no shipping), and drives its status (Picked Up →
 * In Transit → Delivered). The platform aggregates: the order completes once
 * every vendor's shipment is delivered. */
export function VendorShipments({
  order,
  onChange,
}: {
  order: string;
  onChange?: () => void;
}) {
  const { t, locale } = useI18n();
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function hydrate(rows: Shipment[]) {
    setShipments(rows);
    const d: Record<string, Draft> = {};
    for (const s of rows) {
      d[s.name] = {
        carrier: s.carrier ?? "",
        tracking_number: s.tracking_number ?? "",
        tracking_url: s.tracking_url ?? "",
      };
    }
    setDrafts(d);
  }

  useEffect(() => {
    let cancelled = false;
    getMyOrderShipments(order).then((s) => !cancelled && hydrate(s));
    listCarriers().then((c) => !cancelled && setCarriers(c));
    return () => {
      cancelled = true;
    };
  }, [order]);

  const listId = `carriers-${order}`;

  function msg(e: unknown) {
    return e instanceof Error ? e.message : t.vshError;
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await createMyShipment(order);
      hydrate(await getMyOrderShipments(order));
      onChange?.();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails(name: string) {
    const d = drafts[name];
    if (!d) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateMyShipment(name, d);
      setShipments((prev) => (prev ?? []).map((s) => (s.name === name ? updated : s)));
      setSavedName(name);
      setTimeout(() => setSavedName((n) => (n === name ? null : n)), 1500);
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
      const updated = await updateMyShipment(name, { status });
      setShipments((prev) => (prev ?? []).map((s) => (s.name === name ? updated : s)));
      onChange?.();
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

  const field =
    "h-9 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-blue disabled:opacity-50";
  const lbl = "mb-1 block text-xs font-medium text-ink-600";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          <Truck className="h-4 w-4" /> {t.vshPanelTitle}
        </div>
        {shipments.length === 0 && (
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="btn btn-ghost h-8 px-3 text-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            {t.vshCreate}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {shipments.map((s) => {
        const d = drafts[s.name] ?? { carrier: "", tracking_number: "", tracking_url: "" };
        return (
          <div key={s.name} className="space-y-3 rounded-xl border border-line bg-surface p-3">
            {/* Courier details — vendor picks the company that suits them. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>{t.vshCarrier}</label>
                <input
                  value={d.carrier}
                  onChange={(e) => setDrafts({ ...drafts, [s.name]: { ...d, carrier: e.target.value } })}
                  placeholder={carriers.length ? t.vshCarrierChoose : t.vshCarrierPlaceholder}
                  className={field}
                  list={carriers.length ? listId : undefined}
                  disabled={busy}
                />
                {carriers.length > 0 && (
                  <datalist id={listId}>
                    {carriers.map((c) => (
                      <option
                        key={c.carrier_name}
                        value={locale === "en" && c.carrier_name_en ? c.carrier_name_en : c.carrier_name}
                      />
                    ))}
                  </datalist>
                )}
              </div>
              <div>
                <label className={lbl}>{t.vshTrackingNo}</label>
                <input
                  value={d.tracking_number}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [s.name]: { ...d, tracking_number: e.target.value } })
                  }
                  placeholder={t.vshTrackingNoPlaceholder}
                  className={field}
                  dir="ltr"
                  disabled={busy}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>{t.vshTrackingUrl}</label>
                <input
                  value={d.tracking_url}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [s.name]: { ...d, tracking_url: e.target.value } })
                  }
                  placeholder={t.vshTrackingUrlPlaceholder}
                  className={field}
                  dir="ltr"
                  disabled={busy}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <label className={lbl}>{t.vshStatus}</label>
                <select
                  value={s.status}
                  disabled={busy}
                  onChange={(e) => setStatus(s.name, e.target.value)}
                  className="h-9 rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-blue disabled:opacity-50"
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

              <div className="flex items-center gap-3">
                {s.tracking_url && (
                  <a
                    href={s.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    {t.vshTrack} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <a
                  href={`/shop/vendor/shipments/label/${encodeURIComponent(s.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-blue-600"
                >
                  <Printer className="h-4 w-4" /> {t.vshPrintLabel}
                </a>
                <button
                  type="button"
                  onClick={() => saveDetails(s.name)}
                  disabled={busy}
                  className="btn btn-primary h-9 px-4 text-sm disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : savedName === s.name ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {savedName === s.name ? t.vshSaved : t.vshSave}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
