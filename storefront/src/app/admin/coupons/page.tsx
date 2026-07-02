"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { deleteCoupon, listCoupons, upsertCoupon, type Coupon } from "@/lib/coupons-api";

const BLANK = {
  code: "",
  description: "",
  discount_type: "Percentage" as "Percentage" | "Fixed",
  discount_value: "",
  max_discount: "",
  min_subtotal: "",
  usage_limit: "",
  expires_on: "",
};

export default function AdminCouponsPage() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listCoupons());
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
      await upsertCoupon({
        code: form.code,
        description: form.description || undefined,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value) || 0,
        max_discount: Number(form.max_discount) || 0,
        min_subtotal: Number(form.min_subtotal) || 0,
        usage_limit: Number(form.usage_limit) || 0,
        expires_on: form.expires_on || undefined,
        active: 1,
      });
      setForm({ ...BLANK });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ الكوبون.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Coupon) {
    setError(null);
    try {
      await upsertCoupon({
        code: c.code,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        max_discount: c.max_discount ?? 0,
        min_subtotal: c.min_subtotal ?? 0,
        usage_limit: c.usage_limit ?? 0,
        expires_on: c.expires_on ?? undefined,
        description: c.description ?? undefined,
        active: c.active ? 0 : 1,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التحديث.");
    }
  }

  async function remove(code: string) {
    if (!window.confirm(`حذف الكوبون ${code}؟`)) return;
    setError(null);
    try {
      await deleteCoupon(code);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحذف.");
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">الكوبونات</h2>
        <p className="text-sm text-ink-400">أنشئ أكواد خصم — الخصم يتحمّله المتجر ولا يؤثّر على مستحقات البائعين.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <form onSubmit={save} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <input
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="الكود (مثال: WELCOME10)"
          className={`${field} uppercase`}
        />
        <select
          value={form.discount_type}
          onChange={(e) => setForm({ ...form, discount_type: e.target.value as "Percentage" | "Fixed" })}
          className={field}
        >
          <option value="Percentage">نسبة %</option>
          <option value="Fixed">مبلغ ثابت</option>
        </select>
        <input
          required
          type="number"
          min="0"
          step="any"
          value={form.discount_value}
          onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
          placeholder={form.discount_type === "Percentage" ? "قيمة الخصم %" : "قيمة الخصم"}
          className={field}
        />
        {form.discount_type === "Percentage" && (
          <input
            type="number"
            min="0"
            step="any"
            value={form.max_discount}
            onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
            placeholder="أقصى خصم (اختياري)"
            className={field}
          />
        )}
        <input
          type="number"
          min="0"
          step="any"
          value={form.min_subtotal}
          onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })}
          placeholder="حد أدنى للطلب (اختياري)"
          className={field}
        />
        <input
          type="number"
          min="0"
          value={form.usage_limit}
          onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
          placeholder="حد الاستخدام (0 = بلا حد)"
          className={field}
        />
        <input
          type="date"
          value={form.expires_on}
          onChange={(e) => setForm({ ...form, expires_on: e.target.value })}
          className={field}
        />
        <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          حفظ الكوبون
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Tag className="h-8 w-8" />
          <p>لا توجد كوبونات بعد.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c.code} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-tech font-medium text-ink">{c.code}</span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                    {c.discount_type === "Percentage" ? `${c.discount_value}%` : `${c.discount_value}`}
                  </span>
                  {!c.active && <span className="rounded-full bg-[#f1efe8] px-2 py-0.5 text-xs text-ink-400">موقوف</span>}
                </div>
                <div className="mt-0.5 text-xs text-ink-400">
                  {c.min_subtotal ? `حد أدنى ${c.min_subtotal} · ` : ""}
                  {c.usage_limit ? `${c.used_count ?? 0}/${c.usage_limit} استُخدم` : `${c.used_count ?? 0} استُخدم`}
                  {c.expires_on ? ` · ينتهي ${c.expires_on}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => toggleActive(c)} className="btn btn-ghost h-9 px-3 text-sm">
                  {c.active ? "إيقاف" : "تفعيل"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.code)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-coral-50 hover:text-coral"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
