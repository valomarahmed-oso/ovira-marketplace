"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, ShoppingCart, TrendingDown } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

type Row = {
  product: string;
  title: string;
  views: number;
  cart_adds: number;
  sold: number;
  view_to_cart: number;
  cart_to_sale: number;
  stock_qty: number;
  published: number;
  diagnosis: "unpublished" | "no_data" | "unseen" | "not_tempting" | "abandoned" | "healthy";
};

/** Views → basket → sold, per product.
 *
 *  A sales number alone can't tell a vendor which problem they have: nobody saw
 *  it, everybody saw it and walked away, or plenty added it and abandoned at
 *  checkout. Those are three different fixes, and the funnel is what separates
 *  them — so the page leads with the diagnosis, not the raw counts.
 */
export default function VendorInsightsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setRows(null);
    if (!BASE) return setRows([]);
    try {
      const res = await fetch(
        `${BASE}/api/method/ovira_marketplace.api.product_stats.my_product_funnel?days=${days}`,
        { headers: writeHeaders({ Accept: "application/json" }), credentials: "include", cache: "no-store" }
      );
      const data = await res.json();
      setRows(data?.message?.rows ?? []);
    } catch {
      setRows([]);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const label: Record<Row["diagnosis"], string> = {
    unpublished: t.viUnpublished,
    no_data: t.viNoData,
    unseen: t.viUnseen,
    not_tempting: t.viNotTempting,
    abandoned: t.viAbandoned,
    healthy: t.viHealthy,
  };
  const tone: Record<Row["diagnosis"], string> = {
    unpublished: "bg-ink-50 text-ink-500",
    no_data: "bg-ink-50 text-ink-500",
    unseen: "bg-amber-50 text-amber-700",
    not_tempting: "bg-coral-50 text-coral",
    abandoned: "bg-blue-50 text-blue-700",
    healthy: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.viTitle}</h2>
        <p className="text-sm text-ink-400">{t.viSubtitle}</p>
      </div>

      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-xl px-3 py-1.5 text-sm ${
              days === d ? "bg-blue-600 text-white" : "border border-line text-ink"
            }`}
          >
            {d} {t.viDays}
          </button>
        ))}
      </div>

      {!rows ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-ink-400">{t.viEmpty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.product} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{r.title}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone[r.diagnosis]}`}>
                  {label[r.diagnosis]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Step icon={<Eye className="h-4 w-4" />} value={r.views} label={t.viViews} />
                <Arrow percent={r.view_to_cart} />
                <Step icon={<ShoppingCart className="h-4 w-4" />} value={r.cart_adds} label={t.viCarts} />
                <Arrow percent={r.cart_to_sale} />
                <Step icon={<span className="text-xs">🧾</span>} value={r.sold} label={t.viSold} />
              </div>

              {r.diagnosis !== "healthy" && (
                <p className="text-xs text-ink-400">{t[`viHint_${r.diagnosis}` as keyof typeof t] as string}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-ink">
      <span className="text-ink-400">{icon}</span>
      <span className="font-tech font-medium">{value}</span>
      <span className="text-xs text-ink-400">{label}</span>
    </div>
  );
}

function Arrow({ percent }: { percent: number }) {
  return (
    <span className="flex items-center gap-1 text-xs text-ink-400">
      <TrendingDown className="h-3.5 w-3.5" />
      {percent}%
    </span>
  );
}
