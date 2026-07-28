"use client";

import { useState } from "react";
import { Gift, Loader2, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adjustWallet, getUserWallet, type UserWallet } from "@/lib/operator";
import type { Dict } from "@/lib/i18n";

const REASON_KEY: Record<string, keyof Dict> = {
  Refund: "walletReasonRefund",
  Promotional: "walletReasonPromotional",
  "Order payment": "walletReasonOrderPayment",
  Adjustment: "walletReasonAdjustment",
  Referral: "walletReasonReferral",
  Loyalty: "walletReasonLoyalty",
};

export default function AdminWalletsPage() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fmt = (n: number) =>
    `${Math.round((n + Number.EPSILON) * 100) / 100}`.replace(/\.00$/, "") +
    ` ${locale === "ar" ? "ج.م" : "EGP"}`;

  async function lookup() {
    const u = email.trim();
    if (!u) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    const w = await getUserWallet(u);
    setWallet(w);
    setNotFound(!w);
    setLoading(false);
  }

  async function apply(direction: "Credit" | "Debit") {
    if (!wallet) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await adjustWallet(wallet.user, amt, direction, note.trim() || undefined);
      setAmount("");
      setNote("");
      await lookup();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.walletAdminTitle}</h2>
        <p className="text-sm text-ink-400">{t.walletAdminSub}</p>
      </div>

      <div className="card p-4">
        <label className="mb-1 block text-sm text-ink-600">{t.walletUserLabel}</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="customer@example.com"
            className="input flex-1"
            autoComplete="off"
          />
          <button onClick={lookup} disabled={loading} className="btn btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t.walletLookup}
          </button>
        </div>
        {notFound && <p className="mt-2 text-sm text-coral">{t.walletNoUser}</p>}
      </div>

      {wallet && (
        <>
          <div className="card flex items-center gap-4 bg-gradient-to-br from-blue-600 to-blue-500 p-6 text-white">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
              <Gift className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm text-white/80">{wallet.user}</div>
              <div className="text-3xl font-semibold tabular-nums">{fmt(wallet.balance)}</div>
            </div>
          </div>

          <div className="card space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t.walletAmount}
                className="input"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.walletNote}
                className="input"
              />
            </div>
            {error && <p className="text-sm text-coral">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => apply("Credit")} disabled={busy} className="btn btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t.walletAddCredit}
              </button>
              <button onClick={() => apply("Debit")} disabled={busy} className="btn btn-ghost">
                {t.walletDeduct}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink-700">{t.walletHistory}</h3>
            {!wallet.entries.length ? (
              <p className="py-6 text-center text-sm text-ink-400">{t.walletEmpty}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {wallet.entries.map((e) => {
                  const isCredit = e.entry_type === "Credit";
                  const reason = e.reason ? t[REASON_KEY[e.reason]] ?? e.reason : "";
                  return (
                    <li key={e.name} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-ink-700">{reason}</div>
                        {e.note && <div className="truncate text-xs text-ink-400">{e.note}</div>}
                      </div>
                      <div
                        className={`shrink-0 tabular-nums ${isCredit ? "text-emerald-600" : "text-coral"}`}
                      >
                        {isCredit ? "+" : "−"}
                        {fmt(e.amount)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
