"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, Sparkles, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getMyPoints, redeemPoints, type LoyaltyState } from "@/lib/loyalty-api";
import { formatPrice } from "@/lib/utils";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

export default function LoyaltyPage() {
  const { t } = useI18n();
  const [state, setState] = useState<LoyaltyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setState(await getMyPoints());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    const points = Number(amount);
    if (!points || points <= 0) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await redeemPoints(points);
      setOk(
        t.loyaltyRedeemed
          .replace("{points}", String(res.redeemed_points))
          .replace("{value}", formatPrice(res.credited_value, res.currency)),
      );
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loyaltyRedeemErr);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
      </div>
    );
  }

  if (!state || !state.enabled) {
    return (
      <div className="py-8">
        <div className="card mx-auto max-w-md space-y-3 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Sparkles className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.loyaltyTitle}</h1>
          <p className="text-sm text-ink-400">{t.loyaltyOff}</p>
        </div>
      </div>
    );
  }

  const currency = state.currency ?? "EGP";
  const redeemable = state.redeemable_value ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-ink">{t.loyaltyTitle}</h1>

      <div className="card grid gap-4 bg-gradient-to-br from-blue-50 to-white p-6 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Sparkles className="h-4 w-4 text-blue-600" /> {t.loyaltyBalance}
          </div>
          <div className="mt-1 font-tech text-4xl font-medium text-ink">{state.balance}</div>
          <div className="mt-1 text-sm text-ink-400">
            {t.loyaltyWorth} <span className="font-tech text-mint">{formatPrice(redeemable, currency)}</span>
          </div>
          {/* Points lapse in batches; naming the next one keeps a dropping
              balance from looking like a bug. */}
          {state.next_expiry_on && (state.next_expiry_points ?? 0) > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
              <Clock className="h-3.5 w-3.5" />
              {t.loyaltyExpiring
                .replace("{points}", String(state.next_expiry_points))
                .replace("{date}", state.next_expiry_on)}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-1 rounded-xl bg-white/70 p-4 text-sm text-ink-600">
          <div className="flex items-center gap-2 font-medium text-ink">
            <Wallet className="h-4 w-4 text-blue-600" /> {t.loyaltyHowTitle}
          </div>
          <p className="text-xs leading-6 text-ink-400">
            {t.loyaltyEarnHint.replace("{rate}", String(state.earn_rate ?? 0)).replace("{currency}", currency)}
          </p>
        </div>
      </div>

      <form onSubmit={redeem} className="card space-y-3 p-6">
        <div className="font-medium text-ink">{t.loyaltyRedeemTitle}</div>
        <p className="text-xs text-ink-400">
          {t.loyaltyRedeemHint.replace("{value}", String(state.redeem_value ?? 0)).replace("{currency}", currency)}
          {state.min_redeem ? ` · ${t.loyaltyMin.replace("{min}", String(state.min_redeem))}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t.loyaltyPointsToRedeem}
            className="h-11 w-40 rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue"
          />
          <button
            type="button"
            onClick={() => setAmount(String(state.balance))}
            className="btn btn-ghost h-11 px-4 text-sm"
          >
            {t.loyaltyRedeemAll}
          </button>
          <button
            type="submit"
            disabled={busy || !Number(amount)}
            className="btn btn-primary h-11 px-5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {t.loyaltyRedeemBtn}
          </button>
        </div>
        {ok && (
          <div className="flex items-center gap-1.5 text-sm text-mint">
            <CheckCircle2 className="h-4 w-4" /> {ok}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-coral">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
      </form>

      <div className="card p-2">
        <div className="px-4 py-3 text-sm font-medium text-ink">{t.loyaltyHistory}</div>
        {state.entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-400">{t.loyaltyNoHistory}</div>
        ) : (
          <div className="divide-y divide-line">
            {state.entries.map((e) => {
              const earn = e.entry_type === "Earn";
              return (
                <div key={e.name} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-ink">{earn ? t.loyaltyEarned : t.loyaltyRedeemedLabel}</div>
                    <div className="text-xs text-ink-400">{formatDate(e.creation)}</div>
                  </div>
                  <div className="text-end">
                    <div className={`font-tech font-medium ${earn ? "text-mint" : "text-coral"}`}>
                      {earn ? "+" : "−"}
                      {e.points}
                    </div>
                    <div className="text-xs text-ink-400">
                      {t.loyaltyBalanceShort}: {e.balance_after}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
