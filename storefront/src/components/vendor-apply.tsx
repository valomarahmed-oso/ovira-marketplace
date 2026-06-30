"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, Store } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { getMyStore, registerVendor, type VendorStore } from "@/lib/vendor";
import { useI18n } from "@/components/i18n-provider";

type Status = "loading" | "guest" | "none" | "pending" | "active";

export function VendorApply() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  const [status, setStatus] = useState<Status>("loading");
  const [store, setStore] = useState<VendorStore | null>(null);
  const [form, setForm] = useState({ vendor_name: "", phone: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setStatus("guest");
      return;
    }
    let cancelled = false;
    getMyStore().then((s) => {
      if (cancelled) return;
      setStore(s);
      setStatus(!s ? "none" : s.status === "Active" ? "active" : "pending");
    });
    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await registerVendor(form);
      setStatus(res.status === "Active" ? "active" : "pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال الطلب.");
      setBusy(false);
    }
  }

  const card = "card mx-auto max-w-lg space-y-4 p-8 text-center";

  if (status === "loading") {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (status === "guest") {
    return (
      <div className={card}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50">
          <Store className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-xl font-medium text-ink">{t.applyTitle}</h2>
        <p className="text-sm text-ink-400">{t.applySignIn}</p>
        <Link href={`/login?next=${encodeURIComponent("/sell")}`} className="btn btn-primary inline-flex">
          {t.loginTitle}
        </Link>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className={card}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f8f1]">
          <CheckCircle2 className="h-6 w-6 text-mint" />
        </div>
        <h2 className="text-xl font-medium text-ink">{t.applyActiveTitle}</h2>
        {store?.vendor_name && <p className="text-sm text-ink-400">{store.vendor_name}</p>}
        <Link href="/vendor" className="btn btn-primary inline-flex">
          {t.openDashboard}
        </Link>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className={card}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fdf2dd]">
          <Clock className="h-6 w-6 text-[#854f0b]" />
        </div>
        <h2 className="text-xl font-medium text-ink">{t.applyPendingTitle}</h2>
        <p className="text-sm text-ink-400">{t.applyPendingSub}</p>
      </div>
    );
  }

  // status === "none" → the application form
  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  return (
    <div className="card mx-auto max-w-lg space-y-5 p-8">
      <div className="text-center">
        <h2 className="text-xl font-medium text-ink">{t.applyTitle}</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input
          required
          placeholder={t.storeName}
          value={form.vendor_name}
          onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
          className={field}
        />
        <input
          inputMode="tel"
          placeholder={t.phone}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={field}
        />
        <textarea
          placeholder={t.applyDescription}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="min-h-24 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue"
        />
        <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
          {busy ? t.submitting : t.submitApplication}
        </button>
      </form>
    </div>
  );
}
