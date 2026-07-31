"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { resyncStock, stockHealth, type StockMismatch } from "@/lib/operator";

/** "The card says 98 and the stock ledger says 1."
 *
 *  That question could previously only be answered by opening two systems side
 *  by side, so it went unanswered — and an order routed to a branch produced a
 *  Sales Order against a warehouse holding zero, which no Delivery Note could
 *  ever be made from. This panel shows both numbers per warehouse, and the gap
 *  between them, with one button that closes it. */
export function StockHealth() {
  const { t } = useI18n();
  const [rows, setRows] = useState<StockMismatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows((await stockHealth()).mismatches);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync(product?: string) {
    setBusy(product ?? "*");
    setError(null);
    try {
      await resyncStock(product);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.stkSyncErr);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="card flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card flex items-center gap-2 p-4 text-sm text-mint">
        <CheckCircle2 className="h-5 w-5" />
        {t.stkHealthy}
      </div>
    );
  }

  const fixable = rows.filter((r) => !r.blocked);

  return (
    <div className="space-y-3 rounded-2xl border border-coral/30 bg-coral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
          <div>
            <p className="font-medium text-coral">
              {t.stkTitle} ({rows.length})
            </p>
            <p className="text-sm text-ink-600">{t.stkSubtitle}</p>
          </div>
        </div>
        {fixable.length > 0 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => sync()}
            className="btn btn-primary shrink-0 disabled:opacity-50"
          >
            {busy === "*" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t.stkSyncAll}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.product} className="rounded-xl bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium text-ink">{r.title}</span>
                <span className="font-tech text-xs text-ink-400" dir="ltr">
                  {" "}
                  · {r.item}
                </span>
              </div>
              {r.blocked ? (
                <span className="rounded-full bg-[#fdf2dd] px-2.5 py-0.5 text-xs text-[#854f0b]">
                  {t.stkBlocked}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => sync(r.product)}
                  className="btn btn-ghost text-sm disabled:opacity-50"
                >
                  {busy === r.product ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t.stkSyncOne}
                </button>
              )}
            </div>

            {/* Per warehouse, because the total agreeing hides a wrong split —
                which is exactly what stopped delivery notes being made. */}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-xs text-ink-400">
                    <th className="pb-1 text-start font-normal">{t.stkWarehouse}</th>
                    <th className="pb-1 text-start font-normal">{t.stkShop}</th>
                    <th className="pb-1 text-start font-normal">{t.stkErp}</th>
                    <th className="pb-1 text-start font-normal">{t.stkReserved}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.warehouses.map((w) => (
                    <tr key={w.warehouse} className="border-t border-line">
                      <td className="py-1 text-ink-600" dir="ltr">
                        {w.warehouse}
                      </td>
                      <td className="py-1 font-tech text-ink">{w.storefront}</td>
                      <td
                        className={`py-1 font-tech ${
                          w.erpnext_available === w.storefront ? "text-ink" : "text-coral"
                        }`}
                      >
                        {w.erpnext_available}
                      </td>
                      <td className="py-1 font-tech text-ink-400">{w.reserved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.blocked && <p className="mt-2 text-xs text-ink-400">{t.stkBlockedWhy}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
