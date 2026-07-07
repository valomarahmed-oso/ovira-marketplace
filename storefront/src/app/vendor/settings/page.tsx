"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Save, Upload, X } from "lucide-react";
import { getMyStore, updateMyStore } from "@/lib/vendor";
import { uploadImage } from "@/lib/uploads";

/** A single image field with device upload + live preview + remove. */
function ImageUpload({
  value,
  onChange,
  aspect,
}: {
  value: string;
  onChange: (url: string) => void;
  aspect: "square" | "wide";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await uploadImage(file));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "تعذّر رفع الصورة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={`relative grid place-items-center overflow-hidden rounded-xl border border-line bg-blue-50 ${
          aspect === "wide" ? "h-28 w-full" : "h-24 w-24"
        }`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
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
      <input ref={ref} type="file" accept="image/*" onChange={pick} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="btn btn-ghost h-9 justify-center px-3 text-sm disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "جارٍ الرفع…" : "ارفع صورة"}
      </button>
      {err && <p className="text-xs text-coral">{err}</p>}
    </div>
  );
}

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
    logo: "",
    banner: "",
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
            logo: s.logo ?? "",
            banner: s.banner ?? "",
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
        {/* Branding: banner + logo drive the public store page (/store/[slug]). */}
        <div>
          <label className={label}>غلاف المتجر</label>
          <ImageUpload value={form.banner} onChange={(banner) => setForm({ ...form, banner })} aspect="wide" />
        </div>
        <div>
          <label className={label}>شعار المتجر</label>
          <ImageUpload value={form.logo} onChange={(logo) => setForm({ ...form, logo })} aspect="square" />
        </div>

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
