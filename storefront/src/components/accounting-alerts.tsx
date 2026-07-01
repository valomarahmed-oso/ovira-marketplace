"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  failedAccountingOrders,
  retryOrderAccounting,
  type FailedAccountingOrder,
} from "@/lib/operator";

/** Operator banner: paid orders whose post-payment booking failed, with retry. */
export function AccountingAlerts() {
  const { t } = useI18n();
  const [rows, setRows] = useState<FailedAccountingOrder[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await failedAccountingOrders());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(order: string) {
    setRetrying(order);
    setNote(null);
    try {
      const res = await retryOrderAccounting(order);
      setNote(res.ok ? t.acctRetrySuccess : t.acctRetryStillFailing);
      await load();
    } catch {
      setNote(t.acctRetryStillFailing);
    } finally {
      setRetrying(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-coral/30 bg-coral-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
        <div>
          <p className="font-medium text-coral">
            {t.acctAlertTitle} ({rows.length})
          </p>
          <p className="text-sm text-ink-600">{t.acctAlertSub}</p>
        </div>
      </div>

      {note && <p className="text-sm text-ink-600">{note}</p>}

      <div className="space-y-2">
        {rows.map((o) => (
          <div
            key={o.name}
            className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <span className="font-medium text-ink">{o.name}</span>
              {o.customer_name && <span className="text-ink-400"> · {o.customer_name}</span>}
              {o.accounting_error && (
                <p className="mt-0.5 truncate text-xs text-ink-400" dir="ltr" title={o.accounting_error}>
                  {o.accounting_error}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={retrying === o.name}
              onClick={() => retry(o.name)}
              className="btn btn-ghost shrink-0 disabled:opacity-50"
            >
              {retrying === o.name ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {retrying === o.name ? t.acctRetrying : t.acctRetry}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
