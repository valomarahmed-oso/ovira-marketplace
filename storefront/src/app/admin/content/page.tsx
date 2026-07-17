"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2, Save } from "lucide-react";
import { getSiteContentAdmin, updateSiteContent } from "@/lib/admin";
import type { SiteContent } from "@/lib/api";

const PAGES: { key: keyof SiteContent; label: string; hint: string }[] = [
  { key: "about_content", label: "من نحن (About us)", hint: "" },
  { key: "careers_content", label: "الوظائف (Careers)", hint: "" },
  { key: "terms_content", label: "الشروط والأحكام (Terms)", hint: "" },
  { key: "privacy_content", label: "الخصوصية (Privacy)", hint: "" },
];

export default function AdminContentPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SiteContent>({});

  useEffect(() => {
    getSiteContentAdmin()
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await updateSiteContent(form);
      setForm(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const area = "min-h-40 w-full rounded-xl border border-line bg-white p-4 font-mono text-sm outline-none focus:border-blue";
  const label = "mb-1.5 block text-sm font-medium text-ink";

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-medium text-ink">محتوى المتجر</h1>
      </div>
      <p className="text-sm text-ink-400">
        عدّل اسم المتجر وسطر الفوتر وصفحات «من نحن / الوظائف / الشروط / الخصوصية» — بدون كود.
        صفحات المحتوى تقبل HTML بسيط (عناوين، فقرات، قوائم، روابط). اترك أي حقل فارغًا للرجوع
        للنسخة الافتراضية.
      </p>

      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      <form onSubmit={save} className="space-y-6">
        <section className="card space-y-4 p-5">
          <div className="font-medium text-ink">الهوية والفوتر</div>
          <div>
            <label className={label}>اسم المتجر</label>
            <input value={form.brand_name ?? ""} onChange={(e) => set("brand_name", e.target.value)} className={field} placeholder="Ovira" />
          </div>
          <div>
            <label className={label}>سطر الفوتر التعريفي</label>
            <input value={form.footer_tagline ?? ""} onChange={(e) => set("footer_tagline", e.target.value)} className={field} placeholder="تسوّق أذكى من بائعين تثق فيهم" />
          </div>
          <div>
            <label className={label}>بريد الدعم</label>
            <input value={form.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} className={field} placeholder="support@yourstore.com" />
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <div className="font-medium text-ink">صفحات المحتوى</div>
          {PAGES.map((p) => (
            <div key={p.key}>
              <label className={label}>{p.label}</label>
              <textarea
                value={(form[p.key] as string) ?? ""}
                onChange={(e) => set(p.key, e.target.value)}
                className={area}
                dir="auto"
                placeholder="<h2>عنوان</h2> <p>نص الفقرة…</p>"
              />
            </div>
          ))}
        </section>

        <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "تم الحفظ" : "حفظ المحتوى"}
        </button>
      </form>
    </div>
  );
}
