"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { confirmDelivery, resendDeliveryOtp } from "@/lib/shipments-api";

/** Operator control: verify handover with the buyer's one-time delivery code. */
export function DeliveryConfirm({
  order,
  confirmed: initialConfirmed,
}: {
  order: string;
  confirmed?: boolean;
}) {
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState(!!initialConfirmed);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const code = otp.trim();
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmDelivery(order, code);
      setConfirmed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      await resendDeliveryOtp(order);
      setResent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <ShieldCheck className="h-4 w-4" />
        {t.deliveryConfirmed}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {t.deliveryConfirmTitle}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder={t.deliveryOtpPlaceholder}
          className="h-10 w-32 rounded-xl border border-line bg-white px-3 text-center font-tech tracking-widest outline-none focus:border-blue"
        />
        <button onClick={confirm} disabled={busy || !otp.trim()} className="btn btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {t.deliveryConfirmBtn}
        </button>
        <button onClick={resend} disabled={busy} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
          {t.deliveryResend}
        </button>
      </div>
      {resent && <p className="text-xs text-mint">{t.deliveryResent}</p>}
      {error && <p className="text-xs text-coral">{error}</p>}
    </div>
  );
}
