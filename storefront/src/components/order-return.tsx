"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import {
  getOrderReturn,
  requestReturn,
  RETURN_REASON_LABEL,
  RETURN_REASONS,
  RETURN_STATUS_LABEL,
  RETURN_STATUS_STYLE,
  type ReturnRequest,
} from "@/lib/returns-api";

const RETURNABLE = new Set(["Shipped", "Completed"]);

/** Buyer return panel on the order detail page: shows an existing return's
 * status, or an "open a return" form when the order is eligible. */
export function OrderReturn({ order, status }: { order: string; status: string }) {
  const [ret, setRet] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrderReturn(order)
      .then((r) => !cancelled && setRet(r))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [order]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await requestReturn(order, reason, details.trim() || undefined);
      setRet(saved);
      setOpen(false);
      setDetails("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الطلب.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  // Nothing to show: no existing return and the order isn't eligible yet.
  if (!ret && !RETURNABLE.has(status)) return null;

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2 font-medium text-ink">
        <RotateCcw className="h-4 w-4 text-blue-600" /> الإرجاع
      </div>

      {ret ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RETURN_STATUS_STYLE[ret.status] ?? "bg-blue-50 text-blue-600"}`}>
              {RETURN_STATUS_LABEL[ret.status] ?? ret.status}
            </span>
            {ret.reason && (
              <span className="text-sm text-ink-400">{RETURN_REASON_LABEL[ret.reason] ?? ret.reason}</span>
            )}
          </div>
          {ret.details && <p className="text-sm text-ink-600">{ret.details}</p>}
          {ret.operator_note && (
            <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-600">
              <span className="text-ink-400">ردّ المتجر: </span>
              {ret.operator_note}
            </p>
          )}
        </div>
      ) : open ? (
        <form onSubmit={submit} className="space-y-3">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue"
          >
            {RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {RETURN_REASON_LABEL[r] ?? r}
              </option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="تفاصيل إضافية (اختياري)"
            className="min-h-20 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue"
          />
          {error && (
            <div className="flex items-center gap-2 text-sm text-coral">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              إرسال الطلب
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-ink-400">استلمت المنتج وفيه مشكلة؟ اطلب إرجاعًا خلال فترة الإرجاع.</p>
          <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost">
            <RotateCcw className="h-4 w-4" /> طلب إرجاع
          </button>
        </div>
      )}
    </div>
  );
}
