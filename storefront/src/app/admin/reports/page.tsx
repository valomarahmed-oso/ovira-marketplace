"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, Printer, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { getFullReport, type FullReport } from "@/lib/reports-api";
import { formatPrice } from "@/lib/utils";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function AdminReportsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [data, setData] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await getFullReport(from, to));
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  function shareWhatsApp() {
    if (!data) return;
    const c = data.currency;
    const lines = [
      `📊 ${t.brand} — ${t.repTitle}`,
      `${data.from_date} → ${data.to_date}`,
      "",
      `${t.repRevenue}: ${data.summary.revenue} ${c}`,
      `${t.repPaidOrders}: ${data.summary.paid_orders}`,
      `${t.repAov}: ${data.summary.aov} ${c}`,
      `${t.repOrders}: ${data.summary.orders}`,
    ];
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
  }

  const box = "rounded-xl border border-line p-4";
  const th = "py-2 pe-3 text-start text-xs font-normal text-ink-400";
  const td = "py-2 pe-3 text-sm text-ink";

  return (
    <div className="space-y-5">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>

      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-medium text-ink">
            <BarChart3 className="h-5 w-5 text-blue-600" /> {t.repTitle}
          </h2>
          <p className="text-sm text-ink-400">{t.repSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm" />
          <button type="button" onClick={load} className="btn btn-ghost h-10 text-sm">{t.repApply}</button>
          <button type="button" onClick={() => window.print()} className="btn btn-ghost h-10 text-sm">
            <Printer className="h-4 w-4" /> {t.repPrintPdf}
          </button>
          <button type="button" onClick={shareWhatsApp} className="btn btn-primary h-10 text-sm">
            <Share2 className="h-4 w-4" /> {t.repWhatsApp}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : !data ? (
        <div className="card p-10 text-center text-ink-400">{t.repEmpty}</div>
      ) : (
        <div className="space-y-5">
          <div className="text-sm text-ink-400">
            {t.repRange}: <b className="text-ink">{data.from_date}</b> → <b className="text-ink">{data.to_date}</b>
            <span className="ms-3">{t.repGeneratedOn}: {data.generated_on}</span>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: t.repRevenue, value: formatPrice(data.summary.revenue, data.currency) },
              { label: t.repPaidOrders, value: String(data.summary.paid_orders) },
              { label: t.repAov, value: formatPrice(data.summary.aov, data.currency) },
              { label: t.repOrders, value: String(data.summary.orders) },
              { label: t.repDiscounts, value: formatPrice(data.summary.discounts, data.currency) },
              { label: t.repShipping, value: formatPrice(data.summary.shipping, data.currency) },
              { label: t.repProducts, value: String(data.inventory.total) },
              { label: t.repOutOfStock, value: String(data.inventory.out_of_stock) },
            ].map((tile) => (
              <div key={tile.label} className="card p-4">
                <div className="text-xs text-ink-400">{tile.label}</div>
                <div className="mt-1 font-tech text-xl font-medium text-ink">{tile.value}</div>
              </div>
            ))}
          </div>

          {/* Orders by status */}
          <div className="card p-5">
            <h3 className="mb-3 font-medium text-ink">{t.repByStatus}</h3>
            <div className="flex flex-wrap gap-2">
              {data.by_status.map((s) => (
                <span key={s.status} className="rounded-lg border border-line px-3 py-1.5 text-sm">
                  {s.status} · <b>{s.cnt}</b>
                </span>
              ))}
            </div>
          </div>

          {/* Top products */}
          <div className="card p-5">
            <h3 className="mb-3 font-medium text-ink">{t.repTopProducts}</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-line"><th className={th}>{t.repProduct}</th><th className={th}>{t.repQty}</th><th className={th}>{t.repRevenue}</th></tr></thead>
                <tbody>
                  {data.top_products.map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className={td}>{r.title}</td>
                      <td className={td}>{r.qty}</td>
                      <td className={td}>{formatPrice(r.revenue, data.currency)}</td>
                    </tr>
                  ))}
                  {data.top_products.length === 0 && <tr><td className="py-3 text-sm text-ink-400" colSpan={3}>{t.repNoData}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vendor sales */}
          <div className="card p-5">
            <h3 className="mb-3 font-medium text-ink">{t.repVendorSales}</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-line"><th className={th}>{t.repVendor}</th><th className={th}>{t.repOrders}</th><th className={th}>{t.repGross}</th><th className={th}>{t.repCommission}</th><th className={th}>{t.repNet}</th></tr></thead>
                <tbody>
                  {data.vendor_sales.map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className={td}>{r.vendor || "—"}</td>
                      <td className={td}>{r.orders}</td>
                      <td className={td}>{formatPrice(r.gross, data.currency)}</td>
                      <td className={td}>{formatPrice(r.commission, data.currency)}</td>
                      <td className={td}>{formatPrice(r.net, data.currency)}</td>
                    </tr>
                  ))}
                  {data.vendor_sales.length === 0 && <tr><td className="py-3 text-sm text-ink-400" colSpan={5}>{t.repNoData}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low stock + coupons */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-3 font-medium text-ink">{t.repLowStock}</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-line"><th className={th}>{t.repProduct}</th><th className={th}>{t.repStock}</th></tr></thead>
                  <tbody>
                    {data.inventory.low_stock.map((r, i) => (
                      <tr key={i} className="border-b border-line last:border-0"><td className={td}>{r.title}</td><td className={td}>{r.stock_qty}</td></tr>
                    ))}
                    {data.inventory.low_stock.length === 0 && <tr><td className="py-3 text-sm text-ink-400" colSpan={2}>{t.repNoData}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="mb-3 font-medium text-ink">{t.repCoupons}</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-line"><th className={th}>{t.repCode}</th><th className={th}>{t.repUsed}</th></tr></thead>
                  <tbody>
                    {data.coupons.map((r, i) => (
                      <tr key={i} className="border-b border-line last:border-0"><td className={td}>{r.code}</td><td className={td}>{r.used_count}</td></tr>
                    ))}
                    {data.coupons.length === 0 && <tr><td className="py-3 text-sm text-ink-400" colSpan={2}>{t.repNoData}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
