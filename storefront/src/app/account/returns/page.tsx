"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  getMyReturns,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
  RETURN_STATUS_STYLE,
  type ReturnRequest,
} from "@/lib/returns-api";
import { formatPrice } from "@/lib/utils";

export default function MyReturnsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyReturns().then((list) => {
      setRows(list);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.returnsTitle}</h2>
        <p className="text-sm text-ink-400">{t.returnsSubtitle}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <RotateCcw className="h-8 w-8" />
          <p>{t.returnsEmpty}</p>
          <p className="text-xs">{t.returnsEmptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.name} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/account/orders/${r.order}`}
                  className="font-tech text-sm font-medium text-blue-600 hover:underline"
                >
                  {r.order}
                </Link>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RETURN_STATUS_STYLE[r.status] ?? ""}`}
                >
                  {RETURN_STATUS_LABEL[r.status] ?? r.status}
                </span>
                {r.date && <span className="ms-auto text-xs text-ink-400">{r.date}</span>}
              </div>

              <div className="text-sm text-ink-600">
                {r.reason && (
                  <span>{RETURN_REASON_LABEL[r.reason] ?? r.reason}</span>
                )}
                {r.details && <span className="text-ink-400"> — {r.details}</span>}
              </div>

              {r.operator_note && (
                <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-ink-500">
                  {r.operator_note}
                </p>
              )}

              {r.status === "Completed" && (r.refund_amount ?? 0) > 0 && (
                <Link
                  href="/account/wallet"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {t.returnRefundedToWallet}: {formatPrice(r.refund_amount ?? 0)}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
