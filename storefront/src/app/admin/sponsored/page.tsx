"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  deleteSponsored,
  listAllSponsored,
  upsertSponsored,
  type SponsoredPlacement,
} from "@/lib/sponsored-api";

const BLANK = {
  product: "",
  target_category: "",
  priority: "",
  budget: "",
  cpc: "",
  starts_on: "",
  ends_on: "",
};

// datetime-local ("YYYY-MM-DDTHH:mm") → Frappe datetime ("YYYY-MM-DD HH:mm").
const toFrappe = (v: string) => (v ? v.replace("T", " ") : undefined);

export default function AdminSponsoredPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<SponsoredPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listAllSponsored());
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
      await upsertSponsored({
        product: form.product.trim(),
        target_category: form.target_category.trim() || undefined,
        priority: Number(form.priority) || 0,
        budget: Number(form.budget) || 0,
        cpc: Number(form.cpc) || 0,
        starts_on: toFrappe(form.starts_on),
        ends_on: toFrappe(form.ends_on) ?? "",
        active: 1,
      });
      setForm({ ...BLANK });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sponsoredSaveErr);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: SponsoredPlacement) {
    setError(null);
    try {
      await upsertSponsored({
        name: s.name,
        product: s.product,
        target_category: s.target_category ?? undefined,
        priority: s.priority ?? 0,
        budget: s.budget ?? 0,
        cpc: s.cpc ?? 0,
        starts_on: s.starts_on ?? undefined,
        ends_on: s.ends_on,
        active: s.active ? 0 : 1,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sponsoredSaveErr);
    }
  }

  async function remove(s: SponsoredPlacement) {
    if (!window.confirm(t.sponsoredDeleteConfirm)) return;
    setError(null);
    try {
      await deleteSponsored(s.name);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sponsoredSaveErr);
    }
  }

  function status(s: SponsoredPlacement): { label: string; cls: string } {
    if (!s.active) return { label: t.dealInactive, cls: "bg-[#f1efe8] text-ink-400" };
    if (s.budget && (s.spend ?? 0) >= s.budget)
      return { label: t.sponsoredExhausted, cls: "bg-[#f1efe8] text-ink-400" };
    if (s.is_live) return { label: t.dealLive, cls: "bg-mint text-white" };
    if (s.ends_on && new Date(s.ends_on.replace(" ", "T")) < new Date())
      return { label: t.dealEnded, cls: "bg-[#f1efe8] text-ink-400" };
    return { label: t.dealScheduled, cls: "bg-blue-50 text-blue-600" };
  }

  const field =
    "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.sponsoredAdminTitle}</h2>
        <p className="text-sm text-ink-400">{t.sponsoredAdminSubtitle}</p>
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
          placeholder={t.sponsoredProduct}
          className={`${field} sm:col-span-2 lg:col-span-1`}
        />
        <input
          value={form.target_category}
          onChange={(e) => setForm({ ...form, target_category: e.target.value })}
          placeholder={t.sponsoredCategoryTarget}
          className={field}
        />
        <input
          type="number"
          min="0"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          placeholder={t.sponsoredPriority}
          className={field}
        />
        <input
          type="number"
          min="0"
          step="any"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
          placeholder={t.sponsoredBudget}
          className={field}
        />
        <input
          type="number"
          min="0"
          step="any"
          value={form.cpc}
          onChange={(e) => setForm({ ...form, cpc: e.target.value })}
          placeholder={t.sponsoredCpc}
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
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary self-end disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.sponsoredSave}
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Megaphone className="h-8 w-8" />
          <p>{t.sponsoredEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => {
            const st = status(s);
            return (
              <div
                key={s.name}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{s.product_title ?? s.product}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {s.target_category_name ?? t.sponsoredGlobal}
                    </span>
                  </div>
                  <div className="mt-0.5 font-tech text-xs text-ink-400">
                    {t.sponsoredPriority} {s.priority ?? 0}
                    {" · "}
                    {t.sponsoredClicks} {s.clicks ?? 0}
                    {" · "}
                    {t.sponsoredImpr} {s.impressions ?? 0}
                    {" · "}
                    {t.sponsoredCtr} {(s.ctr ?? 0).toFixed(1)}%
                    {" · "}
                    {t.sponsoredSpend} {(s.spend ?? 0).toFixed(2)}
                    {s.budget ? `/${s.budget}` : ""}
                    {" · "}
                    {t.dealEnds} {s.ends_on}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(s)}
                    className="btn btn-ghost h-9 px-3 text-sm"
                  >
                    {s.active ? t.dealInactive : t.dealLive}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s)}
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
