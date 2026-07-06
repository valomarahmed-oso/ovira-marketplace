"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, MapPin } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { GOVERNORATES } from "@/lib/addresses-api";
import { listShippingRates, upsertShippingRate, type ShippingRate } from "@/lib/shipping-rates-api";

type Row = { governorate: string; fee: string; free_threshold: string; eta_days: string; enabled: boolean };

const blankRow = (governorate: string): Row => ({
  governorate,
  fee: "",
  free_threshold: "",
  eta_days: "",
  enabled: true,
});

/** Operator manager for per-governorate shipping rates. Shows every governorate
 *  in the address list, pre-filled from any saved rate; saving upserts one row. */
export function ShippingRatesCard() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGov, setSavingGov] = useState<string | null>(null);
  const [savedGov, setSavedGov] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listShippingRates()
      .then((saved) => {
        const byGov = new Map(saved.map((r) => [r.governorate, r]));
        setRows(
          GOVERNORATES.map((g) => {
            const r = byGov.get(g);
            return r
              ? {
                  governorate: g,
                  fee: String(r.fee ?? ""),
                  free_threshold: r.free_threshold ? String(r.free_threshold) : "",
                  eta_days: r.eta_days ? String(r.eta_days) : "",
                  enabled: r.enabled !== 0,
                }
              : blankRow(g);
          }),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  function patch(gov: string, key: keyof Row, value: string | boolean) {
    setRows((rs) => rs.map((r) => (r.governorate === gov ? { ...r, [key]: value } : r)));
    setSavedGov(null);
  }

  async function save(row: Row) {
    setSavingGov(row.governorate);
    setError(null);
    setSavedGov(null);
    try {
      const next = (await upsertShippingRate({
        governorate: row.governorate,
        fee: Number(row.fee) || 0,
        free_threshold: Number(row.free_threshold) || 0,
        eta_days: Number(row.eta_days) || 0,
        enabled: row.enabled ? 1 : 0,
      })) as ShippingRate;
      patch(row.governorate, "fee", String(next.fee ?? ""));
      setSavedGov(row.governorate);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.shipRateSaveErr);
    } finally {
      setSavingGov(null);
    }
  }

  const field = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-blue";

  return (
    <section className="card space-y-3 p-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-blue-600" />
        <div className="font-medium text-ink">{t.shipRatesTitle}</div>
      </div>
      <p className="text-xs text-ink-400">{t.shipRatesHint}</p>

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
          <div className="hidden grid-cols-[1.2fr_1fr_1.3fr_0.9fr_auto_auto] gap-2 px-1 text-xs text-ink-400 md:grid">
            <span>{t.shipRateGov}</span>
            <span>{t.shipRateFee}</span>
            <span>{t.shipRateFree}</span>
            <span>{t.shipRateEta}</span>
            <span>{t.shipRateOn}</span>
            <span></span>
          </div>
          {rows.map((r) => (
            <div
              key={r.governorate}
              className="grid grid-cols-2 items-center gap-2 rounded-xl border border-line p-2 md:grid-cols-[1.2fr_1fr_1.3fr_0.9fr_auto_auto]"
            >
              <span className="text-sm font-medium text-ink">{r.governorate}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={r.fee}
                onChange={(e) => patch(r.governorate, "fee", e.target.value)}
                placeholder={t.shipRateFee}
                className={field}
              />
              <input
                type="number"
                min="0"
                step="any"
                value={r.free_threshold}
                onChange={(e) => patch(r.governorate, "free_threshold", e.target.value)}
                placeholder={t.shipRateFree}
                className={field}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={r.eta_days}
                onChange={(e) => patch(r.governorate, "eta_days", e.target.value)}
                placeholder={t.shipRateEta}
                className={field}
              />
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => patch(r.governorate, "enabled", e.target.checked)}
                  className="h-4 w-4 accent-blue"
                />
              </label>
              <button
                type="button"
                onClick={() => save(r)}
                disabled={savingGov === r.governorate}
                className="btn btn-ghost h-9 justify-center px-3 text-sm disabled:opacity-50"
              >
                {savingGov === r.governorate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : savedGov === r.governorate ? (
                  <Check className="h-4 w-4 text-mint" />
                ) : (
                  t.shipRateSave
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
