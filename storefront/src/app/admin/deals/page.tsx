"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { deleteDeal, listAllDeals, upsertDeal, type Deal } from "@/lib/deals-api";

const BLANK = {
  product: "",
  deal_price: "",
  starts_on: "",
  ends_on: "",
  stock_limit: "",
};

// datetime-local ("YYYY-MM-DDTHH:mm") → Frappe datetime ("YYYY-MM-DD HH:mm").
const toFrappe = (v: string) => (v ? v.replace("T", " ") : undefined);

export default function AdminDealsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listAllDeals());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await upsertDeal({
        product: form.product.trim(),
        deal_price: Number(form.deal_price) || 0,
        starts_on: toFrappe(form.starts_on),
        ends_on: toFrappe(form.ends_on) ?? "",
        stock_limit: Number(form.stock_limit) || 0,
        active: 1,
      });
      setForm({ ...BLANK });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.dealSaveErr);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(d: Deal) {
    setError(null);
    try {
      await upsertDeal({
        name: d.name,
        product: d.product,
        deal_price: d.deal_price,
        starts_on: d.starts_on ?? undefined,
        ends_on: d.ends_on,
        stock_limit: d.stock_limit ?? 0,
        active: d.active ? 0 : 1,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.dealSaveErr);
    }
  }

  async function remove(d: Deal) {
    if (!window.confirm(t.dealDeleteConfirm)) return;
    setError(null);
    try {
      await deleteDeal(d.name);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.dealSaveErr);
    }
  }

  function status(d: Deal): { label: string; cls: string } {
    if (!d.active) return { label: t.dealInactive, cls: "bg-[#f1efe8] text-ink-400" };
    if (d.is_live) return { label: t.dealLive, cls: "bg-mint text-white" };
    if (d.ends_on && new Date(d.ends_on.replace(" ", "T")) < new Date())
      return { label: t.dealEnded, cls: "bg-[#f1efe8] text-ink-400" };
    return { label: t.dealScheduled, cls: "bg-blue-50 text-blue-600" };
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.dealsAdminTitle}</h2>
        <p className="text-sm text-ink-400">{t.dealsAdminSubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <form onSubmit={save} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <input
          required
          value={form.product}
          onChange={(e) => setForm({ ...form, product: e.target.value })}
          placeholder={t.dealProduct}
          className={`${field} sm:col-span-2 lg:col-span-1`}
        />
        <input
          required
          type="number"
          min="0"
          step="any"
          value={form.deal_price}
          onChange={(e) => setForm({ ...form, deal_price: e.target.value })}
          placeholder={t.dealPrice}
          className={field}
        />
        <input
          type="number"
          min="0"
          value={form.stock_limit}
          onChange={(e) => setForm({ ...form, stock_limit: e.target.value })}
          placeholder={t.dealStockLimit}
          className={field}
        />
        <label className="flex flex-col gap-1 text-xs text-ink-400">
          {t.dealStarts}
          <input
            type="datetime-local"
            value={form.starts_on}
            onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-400">
          {t.dealEnds}
          <input
            required
            type="datetime-local"
            value={form.ends_on}
            onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
            className={field}
          />
        </label>
        <button type="submit" disabled={busy} className="btn btn-primary self-end disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.dealSave}
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Zap className="h-8 w-8" />
          <p>{t.dealEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => {
            const s = status(d);
            return (
              <div key={d.name} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{d.product_title ?? d.product}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="mt-0.5 font-tech text-xs text-ink-400">
                    {d.product_price ? (
                      <span className="line-through">{d.product_price}</span>
                    ) : null}{" "}
                    <span className="text-coral">→ {d.deal_price}</span>
                    {" · "}
                    {t.dealEnds} {d.ends_on}
                    {d.stock_limit ? ` · ${d.sold ?? 0}/${d.stock_limit}` : d.sold ? ` · ${t.dealSold} ${d.sold}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => toggleActive(d)} className="btn btn-ghost h-9 px-3 text-sm">
                    {d.active ? t.dealInactive : t.dealLive}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(d)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-coral-50 hover:text-coral"
                    aria-label={t.dealDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
