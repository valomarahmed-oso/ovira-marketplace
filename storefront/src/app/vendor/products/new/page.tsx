"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Save } from "lucide-react";
import { MOCK_CATEGORIES } from "@/lib/api";
import { useVendor } from "@/lib/vendor-store";

export default function NewProductPage() {
  const router = useRouter();
  const addProduct = useVendor((s) => s.addProduct);
  const [form, setForm] = useState({
    title: "",
    category: MOCK_CATEGORIES[0].category_name,
    price: "",
    compare_at_price: "",
    stock: "",
    condition: "New" as "New" | "Used" | "Refurbished",
    image: "",
    description: "",
  });
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // TODO: POST to ovira_marketplace.api.products.upsert_product when backend is wired.
    addProduct({
      title: form.title,
      category: form.category,
      price: Number(form.price) || 0,
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : undefined,
      stock: Number(form.stock) || 0,
      condition: form.condition,
      image: form.image || undefined,
      description: form.description || undefined,
    });
    router.push("/vendor/products");
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
                {MOCK_CATEGORIES.map((c) => (
                  <option key={c.slug}>{c.category_name}</option>
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
            <Save className="h-4 w-4" /> حفظ المنتج
          </button>
          <p className="text-center text-xs text-ink-400">المنتج هيتراجع من الإدارة قبل النشر</p>
        </div>
      </form>
    </div>
  );
}
