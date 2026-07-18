"use client";

import { useEffect, useState } from "react";
import { Boxes, Check, Loader2, PackagePlus } from "lucide-react";
import { lowStockProducts, restockProduct, type LowStockProduct } from "@/lib/operator";
import { useI18n } from "@/components/i18n-provider";

export default function AdminInventoryPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    lowStockProducts()
      .then(setRows)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function restock(p: LowStockProduct) {
    const n = Number(qty[p.name]);
    if (!n || n <= 0) return;
    setBusy(p.name);
    setError(null);
    try {
      const res = await restockProduct(p.name, n);
      setRows((rs) => rs.map((r) => (r.name === p.name ? { ...r, stock_qty: res.stock_qty } : r)));
      setQty((q) => ({ ...q, [p.name]: "" }));
      setDone(p.name);
      setTimeout(() => setDone(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.invnErr);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Boxes className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-medium text-ink">{t.invnTitle}</h1>
      </div>
      <p className="text-sm text-ink-400">{t.invnSubtitle}</p>

      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-ink-400">
          <Check className="mx-auto mb-2 h-7 w-7 text-mint" />
          {t.invnEmpty}
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden p-0">
          {rows.map((p) => (
            <div key={p.name} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 grow">
                <div className="truncate text-sm text-ink">{p.title}</div>
                <div className="text-xs text-ink-400">
                  {p.vendor_name ? `${p.vendor_name} · ` : ""}
                  {t.invnAvailable} <span className="font-tech text-coral">{p.stock_qty}</span> / {t.invnThreshold} {p.low_stock_threshold}
                </div>
              </div>
              <input
                type="number"
                min="1"
                value={qty[p.name] ?? ""}
                onChange={(e) => setQty((q) => ({ ...q, [p.name]: e.target.value }))}
                placeholder={t.invnQtyPlaceholder}
                className="h-10 w-24 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue"
              />
              <button
                type="button"
                onClick={() => restock(p)}
                disabled={busy === p.name || !qty[p.name]}
                className="btn btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {busy === p.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : done === p.name ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <PackagePlus className="h-4 w-4" />
                )}
                {done === p.name ? t.invnDone : t.invnRestock}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
