"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { getCategories, type Category } from "@/lib/api";
import { upsertProduct } from "@/lib/vendor";

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    compare_at_price: "",
    stock: "",
    condition: "New" as "New" | "Used" | "Refurbished",
    image: "",
    description: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
      setForm((f) => (f.category ? f : { ...f, category: cats[0]?.name ?? "" }));
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await upsertProduct({
        title: form.title,
        category: form.category || undefined,
        price: Number(form.price) || 0,
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : undefined,
        stock_qty: form.stock ? Number(form.stock) : undefined,
        condition: form.condition,
        image: form.image || undefined,
        description: form.description || undefined,
      });
      router.push("/vendor/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ المنتج.");
      setBusy(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const label = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/vendor/products" className="grid h-9 w-9 place-items-center rounded-xl border border-line hover:bg-blue-50">
          <ArrowRight className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-medium text-ink">إضافة منتج</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card space-y-4 p-5">
            <div>
              <label className={label}>اسم المنتج</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} placeholder="مثال: سماعة بلوتوث لاسلكية" />
            </div>
            <div>
              <label className={label}>الوصف</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-28 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue"
                placeholder="اكتب وصفًا واضحًا للمنتج ومميزاته"
              />
            </div>
            <div>
              <label className={label}>رابط صورة المنتج</label>
              <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className={field} placeholder="https://…" inputMode="url" />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-4 p-5">
            <div>
              <label className={label}>القسم</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.category_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>الحالة</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as "New" | "Used" | "Refurbished" })}
                className={field}
              >
                <option value="New">جديد</option>
                <option value="Used">مستعمل</option>
                <option value="Refurbished">مُجدّد</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>السعر</label>
                <input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={field} placeholder="0" />
              </div>
              <div>
                <label className={label}>قبل الخصم</label>
                <input type="number" min="0" value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} className={field} placeholder="—" />
              </div>
            </div>
            <div>
              <label className={label}>المخزون</label>
              <input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={field} placeholder="0" />
            </div>
          </section>

          <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ المنتج
          </button>
          <p className="text-center text-xs text-ink-400">المنتج هيتراجع من الإدارة قبل النشر</p>
        </div>
      </form>
    </div>
  );
}
