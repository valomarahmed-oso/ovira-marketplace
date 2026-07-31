"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { ReturnSettlement } from "@/components/return-settlement";
import {
  listReturns,
  RETURN_STATUS_STYLE,
  setReturnStatus,
  type ReturnRequest,
  type ReturnStatus,
} from "@/lib/returns-api";

const TABS: (ReturnStatus | "All")[] = ["All", "Requested", "Approved", "Rejected", "Completed"];

export default function AdminReturnsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;
  const statusLabel: Record<string, string> = {
    Requested: t.rstRequested,
    Approved: t.rstApproved,
    Rejected: t.rstRejected,
    Completed: t.rstCompleted,
  };
  const tabLabel: Record<string, string> = { All: t.rtnAll, ...statusLabel };
  const reasonLabel: Record<string, string> = {
    Damaged: t.rrnDamaged,
    "Wrong item": t.rrnWrongItem,
    "Not as described": t.rrnNotAsDescribed,
    "Changed mind": t.rrnChangedMind,
    Other: t.rrnOther,
  };

  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [tab, setTab] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Editable refund per row. The server fills a sensible default the moment a
  // return is approved, so this starts populated rather than blank — a blank
  // field is how every return on this store completed refunding nothing.
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listReturns(tab));
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  function patchRow(name: string, patch: Partial<ReturnRequest>) {
    setRows((prev) => prev.map((r) => (r.name === name ? { ...r, ...patch } : r)));
  }

  async function decide(row: ReturnRequest, status: ReturnStatus) {
    setActingOn(row.name);
    setError(null);
    try {
      const typed = amounts[row.name];
      const amount = typed === undefined || typed === "" ? undefined : Number(typed);
      const updated = await setReturnStatus(
        row.name,
        status,
        notes[row.name]?.trim() || undefined,
        Number.isFinite(amount) ? amount : undefined,
      );
      setRows((prev) =>
        // Drop it from a filtered tab if it no longer matches.
        prev.flatMap((r) => {
          if (r.name !== row.name) return [r];
          return tab !== "All" && status !== tab ? [] : [{ ...r, ...updated }];
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rtnUpdateErr);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.rtnTitle}</h2>
        <p className="text-sm text-ink-400">{t.rtnSubtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              tab === s ? "bg-blue text-white" : "border border-line text-ink-600 hover:bg-blue-50"
            }`}
          >
            {tabLabel[s]}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <RotateCcw className="h-8 w-8" />
          <p>{t.rtnEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const acting = actingOn === r.name;
            const open = r.status === "Requested";
            return (
              <div key={r.name} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-tech text-sm text-ink-400">{r.name}</span>
                    <span className="font-tech text-sm text-ink">{r.order}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RETURN_STATUS_STYLE[r.status] ?? "bg-blue-50 text-blue-600"}`}>
                      {statusLabel[r.status] ?? r.status}
                    </span>
                  </div>
                  <span className="text-xs text-ink-400">{r.date}</span>
                </div>

                <div className="text-sm text-ink-600">
                  <span className="text-ink-400">{t.rtnReason} </span>
                  {reasonLabel[r.reason ?? ""] ?? r.reason ?? "—"}
                  {r.customer_email && <span className="text-ink-400"> · {r.customer_email}</span>}
                </div>
                {r.details && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-600">{r.details}</p>}
                {r.operator_note && (
                  <p className="text-sm text-ink-400">{t.rtnYourNote} {r.operator_note}</p>
                )}

                {open ? (
                  <div className="space-y-2 border-t border-line pt-3">
                    <input
                      value={notes[r.name] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.name]: e.target.value }))}
                      placeholder={t.rtnNotePlaceholder}
                      className="h-10 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => decide(r, "Approved")}
                        className="btn btn-primary disabled:opacity-50"
                      >
                        {acting && <Loader2 className="h-4 w-4 animate-spin" />} {t.rtnApprove}
                      </button>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => decide(r, "Rejected")}
                        className="btn btn-ghost text-coral disabled:opacity-50"
                      >
                        {t.rtnReject}
                      </button>
                    </div>
                  </div>
                ) : r.status === "Approved" ? (
                  <>
                    {/* Fault has to be settled BEFORE completing — that's when the
                        vendor chargeback books. */}
                    <ReturnSettlement row={r} onUpdated={(patch) => patchRow(r.name, patch)} />
                    <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
                      <label className="block text-sm">
                        <span className="mb-1 block text-ink-400">{t.rtnRefundAmount}</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          dir="ltr"
                          value={amounts[r.name] ?? String(r.refund_amount ?? 0)}
                          onChange={(e) =>
                            setAmounts((a) => ({ ...a, [r.name]: e.target.value }))
                          }
                          className="h-10 w-40 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => decide(r, "Completed")}
                        className="btn btn-primary disabled:opacity-50"
                      >
                        {acting && <Loader2 className="h-4 w-4 animate-spin" />} {t.rtnMarkComplete}
                      </button>
                      <p className="w-full text-xs text-ink-400">{t.rtnRefundAmountHint}</p>
                      {/* Every completed return on this store once sat at zero,
                          silently skipping the wallet credit, the chargeback and
                          the notification. Say it before the click, not after. */}
                      {Number(amounts[r.name] ?? r.refund_amount ?? 0) <= 0 && (
                        <p className="flex w-full items-center gap-1.5 text-xs text-coral">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {t.rtnZeroWarning}
                        </p>
                      )}
                    </div>
                  </>
                ) : r.status === "Completed" ? (
                  <ReturnSettlement row={r} onUpdated={(patch) => patchRow(r.name, patch)} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
