"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { payVendor, runAllPayouts, vendorPayouts, type VendorPayout } from "@/lib/operator";

const ALL = "__all__";

function money(amount: number, currency?: string): string {
  return `${new Intl.NumberFormat().format(Math.round(amount * 100) / 100)}${currency ? ` ${currency}` : ""}`;
}

export default function AdminPayoutsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<VendorPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await vendorPayouts());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  async function payOne(row: VendorPayout) {
    setActingOn(row.vendor);
    setError(null);
    setNotice(null);
    try {
      const res = await payVendor(row.vendor);
      setNotice(res.paid ? t.payoutSuccess : res.message || t.payoutNothing);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payoutError);
    } finally {
      setActingOn(null);
    }
  }

  async function payAll() {
    if (!window.confirm(t.payoutConfirmAll)) return;
    setActingOn(ALL);
    setError(null);
    setNotice(null);
    try {
      const res = await runAllPayouts();
      setNotice(`${t.payoutSuccess} (${res.count})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payoutError);
    } finally {
      setActingOn(null);
    }
  }

  const currency = rows[0]?.currency;
  const totalDue = rows.reduce((sum, r) => sum + (r.balance_due || 0), 0);
  const anyDue = rows.some((r) => r.balance_due > 0);
  const busy = actingOn !== null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium text-ink">{t.payoutsTitle}</h2>
          <p className="text-sm text-ink-400">{t.payoutsSubtitle}</p>
        </div>
        <button
          type="button"
          disabled={busy || !anyDue}
          onClick={payAll}
          className="btn btn-primary disabled:opacity-50"
        >
          {actingOn === ALL ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          {t.payoutPayAll}
        </button>
      </div>

      <div className="card flex items-center justify-between p-4">
        <span className="text-sm text-ink-400">{t.payoutTotalDue}</span>
        <span className="text-lg font-semibold text-ink" dir="ltr">
          {money(totalDue, currency)}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-[#e7f8f1] px-4 py-3 text-sm text-mint">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Wallet className="h-8 w-8" />
          <p>{t.payoutNoneDue}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const acting = actingOn === r.vendor;
            const due = r.balance_due > 0;
            return (
              <div
                key={r.vendor}
                className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="truncate font-medium text-ink">{r.vendor_name}</span>
                  <div className="mt-1 text-sm text-ink-400" dir="ltr">
                    {money(r.balance_due, r.currency)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !due}
                  onClick={() => payOne(r)}
                  className="btn btn-primary shrink-0 disabled:opacity-50"
                >
                  {acting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t.payoutPay}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
