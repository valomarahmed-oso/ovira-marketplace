"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Scale, Undo2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { formatPrice } from "@/lib/utils";
import {
  getChargebackPreview,
  getRefundCapability,
  refundToSource,
  setReturnStatus,
  type ChargebackPreview,
  type RefundCapability,
  type ReturnFault,
  type ReturnRequest,
} from "@/lib/returns-api";

const FAULTS: ReturnFault[] = ["Vendor", "Store", "Goodwill"];

/** Who pays for a refund, and how it leaves the business.
 *
 *  The fault must be settled BEFORE the return is completed — that's the moment
 *  the vendor chargeback books. Amounts here stay in the base currency: they're
 *  settled accounting figures, not shopper-facing prices. */
export function ReturnSettlement({
  row,
  onUpdated,
}: {
  row: ReturnRequest;
  onUpdated: (patch: Partial<ReturnRequest>) => void;
}) {
  const { t } = useI18n();
  const [fault, setFault] = useState<ReturnFault>(row.fault ?? "Vendor");
  const [preview, setPreview] = useState<ChargebackPreview | null>(null);
  const [cap, setCap] = useState<RefundCapability | null>(null);
  const [busy, setBusy] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const booked = !!row.chargeback_entry;

  const loadPreview = useCallback(async () => {
    setPreview(await getChargebackPreview(row.name));
  }, [row.name]);

  useEffect(() => {
    void loadPreview();
    void getRefundCapability(row.order).then(setCap);
  }, [loadPreview, row.order]);

  async function saveFault(next: ReturnFault) {
    setFault(next);
    setBusy(true);
    setError(null);
    try {
      await setReturnStatus(row.name, row.status, undefined, undefined, next);
      onUpdated({ fault: next });
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rtnUpdateErr);
    } finally {
      setBusy(false);
    }
  }

  async function sendToSource() {
    setRefunding(true);
    setError(null);
    setDone(null);
    try {
      const res = await refundToSource(row.name);
      if (res.ok) {
        setDone(res.reference || "—");
        onUpdated({
          refund_reference: res.reference,
          refund_method: "Original payment method",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.rtnRefundFailed);
    } finally {
      setRefunding(false);
    }
  }

  const faultLabel: Record<ReturnFault, string> = {
    Vendor: t.rtnFaultVendor,
    Store: t.rtnFaultStore,
    Goodwill: t.rtnFaultGoodwill,
  };

  const notApplicable: Record<string, string> = {
    no_refund: t.rtnCbNoRefund,
    disabled: t.rtnCbDisabled,
    not_vendor_fault: t.rtnCbOperatorAbsorbs,
    multi_vendor: t.rtnCbMultiVendor,
  };

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Scale className="h-4 w-4 text-blue-600" />
        {t.rtnWhoPays}
      </div>

      <div className="flex flex-wrap gap-2">
        {FAULTS.map((f) => (
          <button
            key={f}
            type="button"
            disabled={busy || booked}
            onClick={() => saveFault(f)}
            className={`rounded-full px-3 py-1.5 text-sm disabled:opacity-60 ${
              fault === f ? "bg-blue text-white" : "border border-line text-ink-600"
            }`}
          >
            {faultLabel[f]}
          </button>
        ))}
        {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-blue-600" />}
      </div>

      {booked && <p className="text-xs text-ink-400">{t.rtnCbLocked}</p>}

      {/* The Amazon-style split, previewed before it books. */}
      {preview?.applies ? (
        <dl className="grid gap-1 rounded-xl bg-ink-50/60 p-3 text-sm">
          <Line label={t.rtnCbRefund} value={formatPrice(row.refund_amount ?? 0)} />
          <Line
            label={t.rtnCbCommissionBack}
            value={`− ${formatPrice(preview.commission_returned ?? 0)}`}
          />
          <Line label={t.rtnCbAdminFee} value={formatPrice(preview.admin_fee ?? 0)} muted />
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2 font-medium">
            <dt className="text-ink">{t.rtnCbVendorPays}</dt>
            <dd className="font-tech text-ink" dir="ltr">
              {formatPrice(preview.charged ?? 0)}
            </dd>
          </div>
          {preview.vendor && (
            <p className="text-xs text-ink-400">
              {t.rtnCbVendor}: <span className="font-tech">{preview.vendor}</span>
            </p>
          )}
        </dl>
      ) : preview ? (
        <p className="rounded-xl bg-[#fdf2dd] px-3 py-2 text-xs text-[#854f0b]">
          {notApplicable[preview.reason ?? ""] ?? t.rtnCbOperatorAbsorbs}
        </p>
      ) : null}

      {booked && (
        <p className="text-xs text-ink-400">
          {t.rtnCbBooked}: <span className="font-tech">{row.chargeback_entry}</span> ·{" "}
          {formatPrice(row.vendor_charged ?? 0)}
        </p>
      )}

      {/* How the money reaches the customer. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <span className="text-sm text-ink-600">{t.rtnRefundVia}</span>
        {row.refund_reference ? (
          <span className="flex items-center gap-1.5 text-sm text-mint">
            <CheckCircle2 className="h-4 w-4" />
            {t.rtnRefundedToSource} · <span className="font-tech">{row.refund_reference}</span>
          </span>
        ) : cap?.supported && cap.paid ? (
          <button
            type="button"
            onClick={sendToSource}
            disabled={refunding || (row.refund_amount ?? 0) <= 0}
            className="btn btn-ghost h-9 border border-line text-sm disabled:opacity-50"
          >
            {refunding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" />
            )}
            {t.rtnRefundToSource.replace("{0}", cap.provider ?? "")}
          </button>
        ) : (
          <span className="text-xs text-ink-400">{t.rtnRefundStoreCreditOnly}</span>
        )}
      </div>

      {done && (
        <p className="flex items-center gap-1.5 text-sm text-mint">
          <CheckCircle2 className="h-4 w-4" /> {t.rtnRefundSent} · {done}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-1.5 text-sm text-coral">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-ink-400" : "text-ink-600"}>{label}</dt>
      <dd className={`font-tech ${muted ? "text-ink-400" : "text-ink-600"}`} dir="ltr">
        {value}
      </dd>
    </div>
  );
}
