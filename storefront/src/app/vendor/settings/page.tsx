"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { getMyStore, updateMyStore } from "@/lib/vendor";

export default function VendorSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    vendor_name: "",
    description: "",
    return_policy: "",
    shipping_policy: "",
    phone: "",
  });

  useEffect(() => {
    getMyStore()
      .then((store) => {
        if (store) {
          const s = store as unknown as Record<string, string | undefined>;
          setForm({
            vendor_name: s.vendor_name ?? "",
            description: s.description ?? "",
            return_policy: s.return_policy ?? "",
            shipping_policy: s.shipping_policy ?? "",
            phone: s.phone ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateMyStore(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const area = "min-h-24 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue";
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
      <h1 className="text-2xl font-medium text-ink">إعدادات المتجر</h1>
      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}
      <form onSubmit={save} className="card max-w-2xl space-y-4 p-5">
        <div>
          <label className={label}>اسم المتجر</label>
          <input
            value={form.vendor_name}
            onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
            className={field}
            placeholder="اسم متجرك على أوفيرا"
          />
        </div>
        <div>
          <label className={label}>رقم التواصل</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={field}
            inputMode="tel"
            placeholder="مثال: 01xxxxxxxxx"
          />
        </div>
        <div>
          <label className={label}>نبذة عن المتجر</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={area}
            placeholder="عرّف العملاء بمتجرك"
          />
        </div>
        <div>
          <label className={label}>سياسة الإرجاع</label>
          <textarea
            value={form.return_policy}
            onChange={(e) => setForm({ ...form, return_policy: e.target.value })}
            className={area}
            placeholder="مثال: إرجاع مجاني خلال ١٤ يوم"
          />
        </div>
        <div>
          <label className={label}>سياسة الشحن</label>
          <textarea
            value={form.shipping_policy}
            onChange={(e) => setForm({ ...form, shipping_policy: e.target.value })}
            className={area}
            placeholder="مثال: شحن خلال ٢-٤ أيام عمل"
          />
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "تم الحفظ" : "حفظ التغييرات"}
        </button>
      </form>
    </div>
  );
}
