"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  deleteShippingMethod,
  listShippingMethodsAdmin,
  upsertShippingMethod,
  type ShippingMethod,
} from "@/lib/shipping-rates-api";

type Row = {
  /** Empty for a row that hasn't been saved yet. */
  name: string;
  method_name: string;
  method_name_en: string;
  surcharge: string;
  eta_min_days: string;
  eta_max_days: string;
  is_default: boolean;
  enabled: boolean;
};

const toRow = (m: ShippingMethod): Row => ({
  name: m.name,
  method_name: m.method_name ?? "",
  method_name_en: m.method_name_en ?? "",
  surcharge: m.surcharge ? String(m.surcharge) : "",
  eta_min_days: m.eta_min_days ? String(m.eta_min_days) : "",
  eta_max_days: m.eta_max_days ? String(m.eta_max_days) : "",
  is_default: !!m.is_default,
  enabled: m.enabled !== 0,
});

const blankRow = (): Row => ({
  name: "",
  method_name: "",
  method_name_en: "",
  surcharge: "",
  eta_min_days: "",
  eta_max_days: "",
  is_default: false,
  enabled: true,
});

/** Operator manager for the delivery options shoppers pick between.
 *
 *  These sit on top of whatever prices delivery today — the governorate rate
 *  table in Operator mode, each vendor's own rule in Per-Vendor mode — so one
 *  list works in both. An empty list is a valid state: the checkout picker
 *  simply doesn't appear.
 */
export function ShippingMethodsCard() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listShippingMethodsAdmin()
      .then((list) => setRows(list.map(toRow)))
      .finally(() => setLoading(false));
  }, []);

  function patch(idx: number, key: keyof Row, value: string | boolean) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
    setSaved(null);
  }

  async function save(idx: number) {
    const row = rows[idx];
    if (!row.method_name.trim()) return;
    setBusy(idx);
    setError(null);
    setSaved(null);
    try {
      const next = await upsertShippingMethod({
        name: row.name || undefined,
        method_name: row.method_name.trim(),
        method_name_en: row.method_name_en.trim(),
        surcharge: Number(row.surcharge) || 0,
        eta_min_days: Number(row.eta_min_days) || 0,
        eta_max_days: Number(row.eta_max_days) || 0,
        is_default: row.is_default ? 1 : 0,
        display_order: idx,
        enabled: row.enabled ? 1 : 0,
      });
      // Re-read the list: saving a default clears the flag on the others.
      const list = await listShippingMethodsAdmin();
      setRows(list.length ? list.map(toRow) : [toRow(next)]);
      setSaved(idx);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.shipMethodSaveErr);
    } finally {
      setBusy(null);
    }
  }

  async function remove(idx: number) {
    const row = rows[idx];
    if (!row.name) {
      setRows((rs) => rs.filter((_, i) => i !== idx));
      return;
    }
    setBusy(idx);
    setError(null);
    try {
      await deleteShippingMethod(row.name);
      setRows((rs) => rs.filter((_, i) => i !== idx));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.shipMethodSaveErr);
    } finally {
      setBusy(null);
    }
  }

  const field = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-blue";

  return (
    <section className="card space-y-3 p-6">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-blue-600" />
        <div className="font-medium text-ink">{t.shipMethodsTitle}</div>
      </div>
      <p className="text-xs text-ink-400">{t.shipMethodsHint}</p>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-ink-400">{t.shipMethodEmpty}</p>}

          {rows.map((r, idx) => (
            <div
              key={r.name || `new-${idx}`}
              className="grid grid-cols-2 items-center gap-2 rounded-xl border border-line p-2 md:grid-cols-[1.3fr_1.3fr_0.9fr_0.8fr_0.8fr_auto_auto_auto_auto]"
            >
              <input
                value={r.method_name}
                onChange={(e) => patch(idx, "method_name", e.target.value)}
                placeholder={t.shipMethodName}
                className={field}
              />
              <input
                value={r.method_name_en}
                onChange={(e) => patch(idx, "method_name_en", e.target.value)}
                placeholder={t.shipMethodNameEn}
                className={field}
              />
              <input
                type="number"
                min="0"
                step="any"
                value={r.surcharge}
                onChange={(e) => patch(idx, "surcharge", e.target.value)}
                placeholder={t.shipMethodSurcharge}
                className={field}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={r.eta_min_days}
                onChange={(e) => patch(idx, "eta_min_days", e.target.value)}
                placeholder={t.shipMethodFrom}
                className={field}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={r.eta_max_days}
                onChange={(e) => patch(idx, "eta_max_days", e.target.value)}
                placeholder={t.shipMethodTo}
                className={field}
              />
              <label className="flex items-center justify-center gap-1 text-xs text-ink-400">
                <input
                  type="radio"
                  name="ship-default"
                  checked={r.is_default}
                  onChange={() => setRows((rs) => rs.map((x, i) => ({ ...x, is_default: i === idx })))}
                  className="h-4 w-4 accent-blue"
                />
                {t.shipMethodDefault}
              </label>
              <label className="flex items-center justify-center gap-1 text-xs text-ink-400">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => patch(idx, "enabled", e.target.checked)}
                  className="h-4 w-4 accent-blue"
                />
                {t.shipMethodOn}
              </label>
              <button
                type="button"
                onClick={() => save(idx)}
                disabled={busy === idx || !r.method_name.trim()}
                className="btn btn-ghost h-9 justify-center px-3 text-sm disabled:opacity-50"
              >
                {busy === idx ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved === idx ? (
                  <Check className="h-4 w-4 text-mint" />
                ) : (
                  t.shipRateSave
                )}
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={busy === idx}
                aria-label={t.shipMethodDelete}
                className="btn btn-ghost h-9 justify-center px-3 text-coral disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, blankRow()])}
            className="btn btn-ghost h-9 gap-2 px-3 text-sm"
          >
            <Plus className="h-4 w-4" />
            {t.shipMethodAdd}
          </button>
        </div>
      )}
    </section>
  );
}
