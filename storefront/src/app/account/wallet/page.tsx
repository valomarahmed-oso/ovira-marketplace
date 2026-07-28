"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, Wallet as WalletIcon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getWallet, type Wallet } from "@/lib/wallet-api";
import type { Dict } from "@/lib/i18n";

const REASON_KEY: Record<string, keyof Dict> = {
  Refund: "walletReasonRefund",
  Promotional: "walletReasonPromotional",
  "Order payment": "walletReasonOrderPayment",
  Adjustment: "walletReasonAdjustment",
  Referral: "walletReasonReferral",
  Loyalty: "walletReasonLoyalty",
};

export default function WalletPage() {
  const { t, locale } = useI18n();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWallet().then((w) => {
      setWallet(w);
      setLoading(false);
    });
  }, []);

  const fmt = (n: number) =>
    `${Math.round((n + Number.EPSILON) * 100) / 100}`.replace(/\.00$/, "") +
    ` ${wallet?.currency || (locale === "ar" ? "ج.م" : "EGP")}`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.walletTitle}</h2>
        <p className="text-sm text-ink-400">{t.walletSubtitle}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="card flex items-center gap-4 bg-gradient-to-br from-blue-600 to-blue-500 p-6 text-white">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
              <WalletIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm text-white/80">{t.walletBalance}</div>
              <div className="text-3xl font-semibold tabular-nums">{fmt(wallet?.balance ?? 0)}</div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink-700">{t.walletHistory}</h3>
            {!wallet?.entries.length ? (
              <p className="py-8 text-center text-sm text-ink-400">{t.walletEmpty}</p>
            ) : (
              <ul className="divide-y divide-line">
                {wallet.entries.map((e) => {
                  const isCredit = e.entry_type === "Credit";
                  const reason = e.reason ? t[REASON_KEY[e.reason]] ?? e.reason : "";
                  return (
                    <li key={e.name} className="flex items-center gap-3 py-3">
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                          isCredit ? "bg-emerald-50 text-emerald-600" : "bg-coral-50 text-coral"
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink-700">{reason}</div>
                        {e.note && <div className="truncate text-xs text-ink-400">{e.note}</div>}
                      </div>
                      <div className="shrink-0 text-end">
                        <div
                          className={`text-sm font-medium tabular-nums ${
                            isCredit ? "text-emerald-600" : "text-coral"
                          }`}
                        >
                          {isCredit ? "+" : "−"}
                          {fmt(e.amount)}
                        </div>
                        {e.creation && (
                          <div className="text-[11px] text-ink-400">
                            {new Date(e.creation).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                          </div>
                        )}
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
