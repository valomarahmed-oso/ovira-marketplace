"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, Printer, Share2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getBuyerReport, type BuyerReport } from "@/lib/reports-api";
import { formatPrice } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export default function BuyerReportsPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState(daysAgo(89));
  const [to, setTo] = useState(today());
  const [data, setData] = useState<BuyerReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await getBuyerReport(from, to));
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function shareWhatsApp() {
    if (!data) return;
    const lines = [
      `🧾 ${t.brepTitle} — ${data.from_date} → ${data.to_date}`,
      "",
      `${t.brepSpent}: ${data.summary.spent} ${data.currency}`,
      `${t.repOrders}: ${data.summary.orders}`,
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
  }

  const th = "py-2 pe-3 text-start text-xs font-normal text-ink-400";
  const td = "py-2 pe-3 text-sm text-ink";

  return (
    <div className="container-ovira space-y-5 py-6">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>

      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-medium text-ink">
            <BarChart3 className="h-6 w-6 text-blue-600" /> {t.brepTitle}
          </h1>
          <p className="text-sm text-ink-400">{t.brepSubtitle}</p>
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
          <div className="text-sm text-ink-400">{t.repRange}: <b className="text-ink">{data.from_date}</b> → <b className="text-ink">{data.to_date}</b></div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: t.brepSpent, value: formatPrice(data.summary.spent, data.currency) },
              { label: t.repOrders, value: String(data.summary.orders) },
              { label: t.repPaidOrders, value: String(data.summary.paid_orders) },
              { label: t.repAov, value: formatPrice(data.summary.aov, data.currency) },
            ].map((tile) => (
              <div key={tile.label} className="card p-4">
                <div className="text-xs text-ink-400">{tile.label}</div>
                <div className="mt-1 font-tech text-xl font-medium text-ink">{tile.value}</div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-medium text-ink">{t.repByStatus}</h3>
            <div className="flex flex-wrap gap-2">
              {data.by_status.map((s) => <span key={s.status} className="rounded-lg border border-line px-3 py-1.5 text-sm">{s.status} · <b>{s.cnt}</b></span>)}
              {data.by_status.length === 0 && <span className="text-sm text-ink-400">{t.repNoData}</span>}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-medium text-ink">{t.brepTopBought}</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-line"><th className={th}>{t.repProduct}</th><th className={th}>{t.repQty}</th><th className={th}>{t.brepSpent}</th></tr></thead>
                <tbody>
                  {data.top_products.map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0"><td className={td}>{r.title}</td><td className={td}>{r.qty}</td><td className={td}>{formatPrice(r.spent, data.currency)}</td></tr>
                  ))}
                  {data.top_products.length === 0 && <tr><td className="py-3 text-sm text-ink-400" colSpan={3}>{t.repNoData}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
