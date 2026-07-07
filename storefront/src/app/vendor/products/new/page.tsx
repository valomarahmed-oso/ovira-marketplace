"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, ImagePlus, Loader2, Save, Upload, X } from "lucide-react";
import { getCategories, type Category } from "@/lib/api";
import { getMyProduct, upsertProduct } from "@/lib/vendor";
import { uploadImage } from "@/lib/uploads";

function ProductForm() {
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const editing = !!editId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(editing);
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
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "تعذّر رفع الصورة.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
      setForm((f) => (f.category ? f : { ...f, category: cats[0]?.name ?? "" }));
    });
  }, []);

  // Prefill when editing an existing product.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    getMyProduct(editId)
      .then((p) => {
        if (cancelled || !p) return;
        setForm({
          title: p.title ?? "",
          category: p.category ?? "",
          price: p.price != null ? String(p.price) : "",
          compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : "",
          stock: p.stock_qty != null ? String(p.stock_qty) : "",
          condition: (p.condition as "New" | "Used" | "Refurbished") ?? "New",
          image: p.image ?? "",
          description: p.description ?? "",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await upsertProduct({
        name: editId ?? undefined,
        title: form.title,
        category: form.category || undefined,
        price: Number(form.price) || 0,
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : undefined,
        stock_qty: form.stock !== "" ? Number(form.stock) : undefined,
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

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/vendor/products" className="grid h-9 w-9 place-items-center rounded-xl border border-line hover:bg-blue-50">
          <ArrowRight className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-medium text-ink">{editing ? "تعديل المنتج" : "إضافة منتج"}</h1>
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
              <label className={label}>صورة المنتج</label>
              <div className="flex items-start gap-3">
                <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-blue-50">
                  {form.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.image} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image: "" })}
                        aria-label="إزالة الصورة"
                        className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-600 shadow hover:text-coral"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <ImagePlus className="h-7 w-7 text-blue-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-ghost w-full justify-center disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "جارٍ الرفع…" : "ارفع صورة من جهازك"}
                  </button>
                  <input
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    className={field}
                    placeholder="أو الصق رابط صورة https://…"
                    inputMode="url"
                  />
                </div>
              </div>
              {uploadErr && <p className="mt-1 text-xs text-coral">{uploadErr}</p>}
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
              <label className={label}>المخزون (الكمية المتاحة)</label>
              <input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={field} placeholder="0" />
              <p className="mt-1 text-xs text-ink-400">لإعادة التوفّر بعد النفاد، عدّل هذا الرقم واحفظ.</p>
            </div>
          </section>

          <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ المنتج
          </button>
          {!editing && <p className="text-center text-xs text-ink-400">المنتج هيتراجع من الإدارة قبل النشر</p>}
        </div>
      </form>
    </div>
  );
}

export default function ProductFormPage() {
  return (
    <Suspense
      fallback={
        <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
        </div>
      }
    >
      <ProductForm />
    </Suspense>
  );
}
