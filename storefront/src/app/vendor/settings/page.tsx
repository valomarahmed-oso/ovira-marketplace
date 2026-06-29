"use client";

import { useState } from "react";
import { Check, Save } from "lucide-react";
import { useVendor } from "@/lib/vendor-store";
import { useHydrated } from "@/lib/use-hydrated";

export default function VendorSettingsPage() {
  const storeName = useVendor((s) => s.storeName);
  const hydrated = useHydrated();
  const [form, setForm] = useState({ name: "", description: "", returns: "" });
  const [saved, setSaved] = useState(false);

  if (!hydrated) {
    return <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>;
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const area = "min-h-24 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue";
  const label = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-ink">إعدادات المتجر</h1>
      <form onSubmit={save} className="card max-w-2xl space-y-4 p-5">
        <div>
          <label className={label}>اسم المتجر</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
            placeholder={storeName}
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
            value={form.returns}
            onChange={(e) => setForm({ ...form, returns: e.target.value })}
            className={area}
            placeholder="مثال: إرجاع مجاني خلال ١٤ يوم"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "تم الحفظ" : "حفظ التغييرات"}
        </button>
      </form>
    </div>
  );
}
