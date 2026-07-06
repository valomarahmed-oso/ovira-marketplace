"use client";

import { useEffect, useState } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  Loader2,
  Megaphone,
  Package,
  Percent,
  Receipt,
  ShoppingBag,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  downloadCsv,
  exportOrdersCsv,
  exportProductsCsv,
  getOperatorOverview,
  type OperatorOverview,
} from "@/lib/analytics-api";
import { useI18n } from "@/components/i18n-provider";
import { formatPrice } from "@/lib/utils";

const WINDOWS = [7, 30, 90, 365] as const;

const STATUS_COLOR: Record<string, string> = {
  "Pending Payment": "bg-[#e9b949]",
  Paid: "bg-blue-600",
  Processing: "bg-[#7c6cf0]",
  Shipped: "bg-[#3aa0ff]",
  Completed: "bg-mint",
  Cancelled: "bg-coral",
};

export default function AdminAnalyticsPage() {
  const { t } = useI18n();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<OperatorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"orders" | "products" | null>(null);

  async function runExport(kind: "orders" | "products") {
    setExporting(kind);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "orders") {
        downloadCsv(`orders-${days}d-${stamp}.csv`, await exportOrdersCsv(days));
      } else {
        downloadCsv(`product-sales-${days}d-${stamp}.csv`, await exportProductsCsv(days));
      }
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    getOperatorOverview(days)
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  const cur = data?.currency ?? "EGP";
  const winLabel: Record<number, string> = {
    7: t.anLast7,
    30: t.anLast30,
    90: t.anLast90,
    365: t.anLast365,
  };

  const kpis = data
    ? [
        { label: t.anGmv, value: formatPrice(data.totals.gmv, cur), icon: TrendingUp },
        { label: t.anCommissionRevenue, value: formatPrice(data.totals.commission, cur), icon: Percent },
        { label: t.anOrders, value: String(data.totals.orders), icon: ShoppingBag },
        { label: t.anCompleted, value: String(data.totals.completed), icon: CheckCircle2 },
        { label: t.anAov, value: formatPrice(data.totals.aov, cur), icon: Receipt },
      ]
    : [];

  const snapshots = data
    ? [
        { label: t.anAdRevenue, value: formatPrice(data.ad_revenue, cur), icon: Megaphone },
        { label: t.anWalletLiability, value: formatPrice(data.wallet_liability, cur), icon: Wallet },
        { label: t.anLoyaltyOutstanding, value: `${data.loyalty_outstanding}`, icon: Award },
      ]
    : [];

  const maxTrend = data ? Math.max(1, ...data.trend.map((d) => d.gmv)) : 1;
  const trendTotal = data ? data.trend.reduce((s, d) => s + d.gmv, 0) : 0;
  const maxProd = data ? Math.max(1, ...data.top_products.map((p) => p.revenue)) : 1;
  const maxVendor = data ? Math.max(1, ...data.top_vendors.map((v) => v.gmv)) : 1;
  const statusTotal = data ? data.status_breakdown.reduce((s, r) => s + r.count, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium text-ink">{t.anOpTitle}</h2>
          <p className="text-sm text-ink-400">{t.anOpSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-line p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  days === w ? "bg-blue-600 text-white" : "text-ink-600 hover:bg-blue-50"
                }`}
              >
                {winLabel[w]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => runExport("orders")}
            disabled={exporting !== null}
            className="btn btn-ghost h-9 gap-1.5 px-3 text-sm disabled:opacity-50"
          >
            {exporting === "orders" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t.anExportOrders}
          </button>
          <button
            type="button"
            onClick={() => runExport("products")}
            disabled={exporting !== null}
            className="btn btn-ghost h-9 gap-1.5 px-3 text-sm disabled:opacity-50"
          >
            {exporting === "products" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t.anExportProducts}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
        </div>
      ) : !data ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <BarChart3 className="h-8 w-8" />
          <p>{t.anNoData}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-400">{k.label}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50">
                    <k.icon className="h-4 w-4 text-blue-600" />
                  </span>
                </div>
                <div className="mt-3 font-tech text-2xl font-medium text-ink">{k.value}</div>
              </div>
            ))}
          </div>

          {/* GMV trend */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium text-ink">{t.anGmvTrend}</h2>
              <span className="font-tech text-sm text-ink-600">
                {t.anGmv}: {formatPrice(data.totals.gmv, cur)}
              </span>
            </div>
            {trendTotal <= 0 ? (
              <div className="py-10 text-center text-sm text-ink-400">{t.anNoTrend}</div>
            ) : (
              <div className="flex h-40 items-end gap-px" dir="ltr">
                {data.trend.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t bg-blue-600/80 transition-colors hover:bg-blue-600"
                    style={{ height: `${Math.max(2, (d.gmv / maxTrend) * 100)}%` }}
                    title={`${d.date}: ${formatPrice(d.gmv, cur)}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top products */}
            <div className="card p-5">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-ink">
                <Package className="h-4 w-4 text-blue-600" /> {t.anTopProducts}
              </h2>
              {data.top_products.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">{t.anNoData}</p>
              ) : (
                <div className="space-y-3">
                  {data.top_products.map((p) => (
                    <div key={p.product}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-ink">{p.title}</span>
                        <span className="shrink-0 font-tech text-ink-600">
                          {formatPrice(p.revenue, cur)}
                          <span className="text-ink-400"> · {p.qty}</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-blue-50">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${(p.revenue / maxProd) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top vendors */}
            <div className="card p-5">
              <h2 className="mb-4 flex items-center gap-2 font-medium text-ink">
                <Store className="h-4 w-4 text-blue-600" /> {t.anTopVendors}
              </h2>
              {data.top_vendors.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">{t.anNoData}</p>
              ) : (
                <div className="space-y-3">
                  {data.top_vendors.map((v) => (
                    <div key={v.vendor}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-ink">{v.vendor_name}</span>
                        <span className="shrink-0 font-tech text-ink-600">
                          {formatPrice(v.gmv, cur)}
                          <span className="text-ink-400"> · {formatPrice(v.commission, cur)}</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-blue-50">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${(v.gmv / maxVendor) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Order status breakdown */}
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-medium text-ink">
              <ShoppingBag className="h-4 w-4 text-blue-600" /> {t.anStatusBreakdown}
            </h2>
            {data.status_breakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">{t.anNoData}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex h-3 overflow-hidden rounded-full bg-blue-50" dir="ltr">
                  {data.status_breakdown.map((s) => (
                    <div
                      key={s.status}
                      className={STATUS_COLOR[s.status] ?? "bg-ink-400"}
                      style={{ width: `${statusTotal ? (s.count / statusTotal) * 100 : 0}%` }}
                      title={`${s.status}: ${s.count}`}
                    />
                  ))}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {data.status_breakdown.map((s) => (
                    <div key={s.status} className="flex items-center gap-2 text-sm">
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[s.status] ?? "bg-ink-400"}`} />
                      <span className="text-ink-600">{s.status}</span>
                      <span className="ms-auto font-tech text-ink">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Point-in-time snapshots */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-ink-400">{t.anSnapshotsTitle}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {snapshots.map((s) => (
                <div key={s.label} className="card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-400">{s.label}</span>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50">
                      <s.icon className="h-4 w-4 text-blue-600" />
                    </span>
                  </div>
                  <div className="mt-3 font-tech text-2xl font-medium text-ink">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
