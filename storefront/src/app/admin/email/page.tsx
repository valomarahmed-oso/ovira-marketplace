"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, Loader2, Mail, Save } from "lucide-react";
import { getEmailConfig, updateEmailConfig } from "@/lib/admin";

export default function AdminEmailPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [form, setForm] = useState({
    email_id: "",
    smtp_server: "",
    smtp_port: "587",
    use_tls: true,
    login_id: "",
    password: "",
  });

  useEffect(() => {
    getEmailConfig()
      .then((c) => {
        if (!c) return;
        setConfigured(!!c.configured);
        setHasPassword(!!c.has_password);
        if (c.configured) {
          setForm((f) => ({
            ...f,
            email_id: c.email_id ?? "",
            smtp_server: c.smtp_server ?? "",
            smtp_port: c.smtp_port != null ? String(c.smtp_port) : "587",
            use_tls: c.use_tls == null ? true : !!c.use_tls,
            login_id: c.login_id ?? "",
          }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await updateEmailConfig({
        email_id: form.email_id,
        smtp_server: form.smtp_server,
        smtp_port: Number(form.smtp_port) || 587,
        use_tls: form.use_tls ? 1 : 0,
        use_ssl: form.use_tls ? 0 : 0,
        login_id: form.login_id || undefined,
        password: form.password || undefined,
      });
      setConfigured(!!res.configured);
      setHasPassword(!!res.has_password);
      setForm((f) => ({ ...f, password: "" }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
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
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-medium text-ink">إعدادات البريد الصادر</h1>
      </div>
      <p className="text-sm text-ink-400">
        اضبط حساب SMTP لإرسال رسائل الطلبات والمرتجعات — من غير ما تفتح ERPNext Desk.
      </p>

      {configured && (
        <div className="flex items-center gap-2 rounded-xl bg-[#e7f8f1] px-4 py-3 text-sm text-mint">
          <CheckCircle2 className="h-4 w-4" /> البريد مُفعّل حاليًا{hasPassword ? " (كلمة المرور محفوظة)" : ""}.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      <form onSubmit={save} className="card space-y-4 p-5">
        <div>
          <label className={label}>البريد المُرسِل منه</label>
          <input
            required
            type="email"
            value={form.email_id}
            onChange={(e) => setForm({ ...form, email_id: e.target.value })}
            className={field}
            placeholder="orders@yourstore.com"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>خادم SMTP</label>
            <input
              required
              value={form.smtp_server}
              onChange={(e) => setForm({ ...form, smtp_server: e.target.value })}
              className={field}
              placeholder="smtp.gmail.com"
            />
          </div>
          <div>
            <label className={label}>المنفذ (Port)</label>
            <input
              type="number"
              value={form.smtp_port}
              onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
              className={field}
              placeholder="587"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.use_tls}
            onChange={(e) => setForm({ ...form, use_tls: e.target.checked })}
            className="h-4 w-4 accent-blue-600"
          />
          استخدام TLS (موصى به لمعظم الخوادم مثل Gmail على المنفذ 587)
        </label>
        <div>
          <label className={label}>اسم الدخول (اختياري — لو مختلف عن البريد)</label>
          <input
            value={form.login_id}
            onChange={(e) => setForm({ ...form, login_id: e.target.value })}
            className={field}
            placeholder="—"
          />
        </div>
        <div>
          <label className={label}>كلمة مرور SMTP {hasPassword ? "(اتركها فارغة للإبقاء على الحالية)" : ""}</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={field}
            placeholder={hasPassword ? "••••••••" : "كلمة المرور أو App Password"}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-ink-400">
            تُحفظ مُشفّرة في ERPNext ولا تظهر بعد الحفظ. لحسابات Gmail استخدم «App Password».
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "تم الحفظ" : "حفظ وتفعيل"}
        </button>
        <p className="text-xs text-ink-400">
          عند الحفظ، يتحقّق ERPNext من الاتصال بالخادم — فلو ظهر خطأ، راجع الخادم/المنفذ/كلمة المرور.
        </p>
      </form>
    </div>
  );
}
