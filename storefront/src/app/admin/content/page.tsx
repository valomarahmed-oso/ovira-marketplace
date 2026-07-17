"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2, Save } from "lucide-react";
import { getSiteContentAdmin, updateSiteContent } from "@/lib/admin";
import type { SiteContent } from "@/lib/api";

const PAGES: { ar: keyof SiteContent; en: keyof SiteContent; label: string }[] = [
  { ar: "about_content", en: "about_content_en", label: "من نحن (About us)" },
  { ar: "careers_content", en: "careers_content_en", label: "الوظائف (Careers)" },
  { ar: "terms_content", en: "terms_content_en", label: "الشروط والأحكام (Terms)" },
  { ar: "privacy_content", en: "privacy_content_en", label: "الخصوصية (Privacy)" },
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
        لكل حقل نسخة <b>عربية</b> ونسخة <b>إنجليزية</b>؛ المتجر بيعرض النسخة حسب لغة الزائر
        ويرجع للعربية لو الإنجليزية فاضية. صفحات المحتوى تقبل HTML بسيط (عناوين، فقرات، قوائم،
        روابط). اترك أي حقل فارغًا للرجوع للنسخة الافتراضية.
      </p>

      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      <form onSubmit={save} className="space-y-6">
        <section className="card space-y-4 p-5">
          <div className="font-medium text-ink">الهوية والفوتر</div>
          <div>
            <label className={label}>اسم المتجر</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={form.brand_name ?? ""} onChange={(e) => set("brand_name", e.target.value)} className={field} dir="rtl" placeholder="عربي — مثال: أوفيرا" />
              <input value={form.brand_name_en ?? ""} onChange={(e) => set("brand_name_en", e.target.value)} className={field} dir="ltr" placeholder="English — e.g. Ovira" />
            </div>
          </div>
          <div>
            <label className={label}>سطر الفوتر التعريفي</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={form.footer_tagline ?? ""} onChange={(e) => set("footer_tagline", e.target.value)} className={field} dir="rtl" placeholder="عربي — تسوّق أذكى من بائعين تثق فيهم" />
              <input value={form.footer_tagline_en ?? ""} onChange={(e) => set("footer_tagline_en", e.target.value)} className={field} dir="ltr" placeholder="English — Shop smarter, from vendors you trust" />
            </div>
          </div>
          <div>
            <label className={label}>بريد الدعم</label>
            <input value={form.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} className={field} dir="ltr" placeholder="support@yourstore.com" />
          </div>
        </section>

        <section className="card space-y-5 p-5">
          <div className="font-medium text-ink">صفحات المحتوى</div>
          {PAGES.map((p) => (
            <div key={p.ar} className="space-y-2">
              <label className={label}>{p.label}</label>
              <div className="grid gap-2 lg:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs text-ink-400">عربي</span>
                  <textarea
                    value={(form[p.ar] as string) ?? ""}
                    onChange={(e) => set(p.ar, e.target.value)}
                    className={area}
                    dir="rtl"
                    placeholder="<h2>عنوان</h2> <p>نص الفقرة…</p>"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-ink-400">English</span>
                  <textarea
                    value={(form[p.en] as string) ?? ""}
                    onChange={(e) => set(p.en, e.target.value)}
                    className={area}
                    dir="ltr"
                    placeholder="<h2>Heading</h2> <p>Paragraph text…</p>"
                  />
                </div>
              </div>
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
