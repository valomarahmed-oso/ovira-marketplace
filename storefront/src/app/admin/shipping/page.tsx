"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { getAdminSettings, updateAdminSettings } from "@/lib/admin";
import {
  listShippingProviders,
  updateShippingProvider,
  type ShippingProviderConfig,
} from "@/lib/operator";

type Provider = ShippingProviderConfig["provider"];

const PROVIDER_FIELDS: Record<
  Provider,
  { name: string; label: string; secret?: boolean; hasKey?: keyof ShippingProviderConfig }[]
> = {
  Manual: [],
  Bosta: [{ name: "api_key", label: "API Key", secret: true, hasKey: "has_api_key" }],
  Aramex: [
    { name: "api_key", label: "API Key", secret: true, hasKey: "has_api_key" },
    { name: "api_secret", label: "API Secret", secret: true, hasKey: "has_api_secret" },
    { name: "account_number", label: "Account Number" },
  ],
  Mylerz: [{ name: "api_key", label: "API Key", secret: true, hasKey: "has_api_key" }],
};

const PROVIDER_LABEL: Record<Provider, string> = {
  Manual: "شحن يدوي (أسعار ثابتة)",
  Bosta: "Bosta — بوسطة",
  Aramex: "Aramex — أرامكس",
  Mylerz: "Mylerz — مايلرز",
};

/** Carriers whose connector code isn't live yet. */
const COMING_SOON: Provider[] = ["Mylerz"];

export default function AdminShippingPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<ShippingProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shippingAccount, setShippingAccount] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [providers, settings] = await Promise.all([listShippingProviders(), getAdminSettings()]);
    setRows(providers);
    setShippingAccount((settings?.shipping_account as string) ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  const setField = (provider: string, field: string, value: string) =>
    setForms((f) => ({ ...f, [provider]: { ...f[provider], [field]: value } }));

  async function save(row: ShippingProviderConfig, enabled?: boolean) {
    setSaving(row.provider);
    setNotice(null);
    setError(null);
    try {
      const updated = await updateShippingProvider({
        provider: row.provider,
        enabled: enabled ?? row.enabled,
        ...(forms[row.provider] ?? {}),
      });
      setRows((prev) => prev.map((r) => (r.provider === row.provider ? updated : r)));
      setForms((f) => ({ ...f, [row.provider]: {} }));
      setNotice(t.paySaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payoutError);
    } finally {
      setSaving(null);
    }
  }

  async function saveAccount() {
    setSaving("__account__");
    setNotice(null);
    setError(null);
    try {
      await updateAdminSettings({ shipping_account: shippingAccount });
      setNotice(t.paySaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payoutError);
    } finally {
      setSaving(null);
    }
  }

  const field =
    "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.shipTitle}</h2>
        <p className="text-sm text-ink-400">{t.shipSubtitle}</p>
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
            return (
              <div key={row.provider} className="card space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
                      <Truck className="h-5 w-5 text-blue-600" />
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-ink-400">{t.shipFlatRate}</span>
                    <input
                      type="number"
                      dir="ltr"
                      value={form.flat_rate ?? String(row.flat_rate ?? "")}
                      onChange={(e) => setField(row.provider, "flat_rate", e.target.value)}
                      className={field}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-ink-400">{t.shipFreeOver}</span>
                    <input
                      type="number"
                      dir="ltr"
                      value={form.free_over ?? String(row.free_over ?? "")}
                      onChange={(e) => setField(row.provider, "free_over", e.target.value)}
                      className={field}
                    />
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
              </div>
            );
          })}

          {/* ERPNext shipping income account */}
          <div className="card space-y-3 p-5">
            <div className="font-medium text-ink">{t.shipIncomeAccount}</div>
            <p className="text-xs text-ink-400">{t.shipIncomeAccountNote}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                dir="ltr"
                value={shippingAccount}
                onChange={(e) => setShippingAccount(e.target.value)}
                placeholder="e.g. Freight and Forwarding Charges - XX"
                className={`${field} flex-1`}
              />
              <button
                type="button"
                disabled={saving === "__account__"}
                onClick={saveAccount}
                className="btn btn-primary disabled:opacity-50"
              >
                {saving === "__account__" && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.paySave}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
