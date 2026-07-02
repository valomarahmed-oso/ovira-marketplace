"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  listPaymentConnectors,
  updatePaymentConnector,
  type PaymentConnector,
} from "@/lib/operator";

type Provider = PaymentConnector["provider"];

/** Which fields each gateway needs. `secret: true` fields are write-only. */
const PROVIDER_FIELDS: Record<
  Provider,
  { name: string; label: string; secret?: boolean; hasKey?: keyof PaymentConnector }[]
> = {
  "Cash on Delivery": [],
  Paymob: [
    { name: "api_key", label: "API Key", secret: true, hasKey: "has_api_key" },
    { name: "integration_id", label: "Integration ID" },
    { name: "iframe_id", label: "iFrame ID" },
    { name: "hmac_secret", label: "HMAC Secret", secret: true, hasKey: "has_hmac_secret" },
  ],
  Fawry: [
    { name: "api_key", label: "Merchant Code", secret: true, hasKey: "has_api_key" },
    { name: "secret_key", label: "Security Key", secret: true, hasKey: "has_secret_key" },
  ],
  Stripe: [
    { name: "secret_key", label: "Secret Key", secret: true, hasKey: "has_secret_key" },
    { name: "public_key", label: "Publishable Key" },
  ],
};

const PROVIDER_LABEL: Record<Provider, string> = {
  "Cash on Delivery": "الدفع عند الاستلام",
  Paymob: "Paymob",
  Fawry: "Fawry",
  Stripe: "Stripe",
};

/** Gateways whose connector code isn't live yet — config stored, not used. */
const COMING_SOON: Provider[] = ["Fawry", "Stripe"];

export default function AdminPaymentsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<PaymentConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listPaymentConnectors());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  const setField = (provider: string, field: string, value: string) =>
    setForms((f) => ({ ...f, [provider]: { ...f[provider], [field]: value } }));

  async function save(row: PaymentConnector, enabled?: boolean) {
    setSaving(row.provider);
    setNotice(null);
    setError(null);
    try {
      const form = forms[row.provider] ?? {};
      const updated = await updatePaymentConnector({
        provider: row.provider,
        enabled: enabled ?? row.enabled,
        ...form,
      });
      setRows((prev) => prev.map((r) => (r.provider === row.provider ? updated : r)));
      // Clear submitted secrets from local state — they're stored server-side now.
      setForms((f) => ({ ...f, [row.provider]: {} }));
      setNotice(t.paySaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payoutError);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.payTitle}</h2>
        <p className="text-sm text-ink-400">{t.paySubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-[#e7f8f1] px-4 py-3 text-sm text-mint">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const fields = PROVIDER_FIELDS[row.provider] ?? [];
            const soon = COMING_SOON.includes(row.provider);
            const busy = saving === row.provider;
            const form = forms[row.provider] ?? {};
            const field =
              "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";
            return (
              <div key={row.provider} className="card space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </span>
                    <div>
                      <div className="font-medium text-ink">{PROVIDER_LABEL[row.provider]}</div>
                      <div className={`text-xs ${row.enabled ? "text-mint" : "text-ink-400"}`}>
                        {row.enabled ? t.payEnabled : t.payDisabled}
                      </div>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={busy}
                      onChange={(e) => save(row, e.target.checked)}
                      className="h-4 w-4 accent-blue"
                    />
                    {t.payEnabled}
                  </label>
                </div>

                {soon && (
                  <p className="rounded-xl bg-[#fdf2dd] px-3 py-2 text-xs text-[#854f0b]">{t.payComingSoon}</p>
                )}

                {fields.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block text-ink-400">{t.payMode}</span>
                      <select
                        value={form.mode ?? row.mode ?? "Test"}
                        onChange={(e) => setField(row.provider, "mode", e.target.value)}
                        className={field}
                      >
                        <option value="Test">{t.payModeTest}</option>
                        <option value="Live">{t.payModeLive}</option>
                      </select>
                    </label>
                    {fields.map((f) => {
                      const stored = f.secret && f.hasKey ? !!row[f.hasKey] : false;
                      const plainValue = !f.secret
                        ? ((row as Record<string, unknown>)[f.name] as string | null | undefined)
                        : undefined;
                      return (
                        <label key={f.name} className="block text-sm">
                          <span className="mb-1 block text-ink-400">{f.label}</span>
                          <input
                            type={f.secret ? "password" : "text"}
                            dir="ltr"
                            value={form[f.name] ?? (f.secret ? "" : plainValue ?? "")}
                            placeholder={f.secret ? (stored ? t.paySecretSet : t.paySecretUnset) : ""}
                            onChange={(e) => setField(row.provider, f.name, e.target.value)}
                            className={field}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}

                {fields.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => save(row)}
                      className="btn btn-primary disabled:opacity-50"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t.paySave}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
