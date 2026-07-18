"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, Store, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { WhatsAppConfigCard } from "@/components/whatsapp-config-card";
import { OperatorStats } from "@/components/operator-stats";
import {
  getAdminSettings,
  getProductOptions,
  updateAdminSettings,
  type AdminSettings,
} from "@/lib/admin";

export default function AdminSettingsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [products, setProducts] = useState<{ name: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !isOperator) return;
    let cancelled = false;
    Promise.all([getAdminSettings(), getProductOptions()]).then(([s, p]) => {
      if (cancelled) return;
      setSettings(s);
      setProducts(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, isOperator]);

  function set<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateAdminSettings({
        mode: settings.mode,
        default_currency: settings.default_currency,
        default_commission_rate: settings.default_commission_rate,
        auto_approve_vendors: settings.auto_approve_vendors,
        auto_approve_products: settings.auto_approve_products,
        sync_website_item: settings.sync_website_item,
        deal_product: settings.deal_product ?? "",
        sales_tax_template: settings.sales_tax_template ?? "",
        shipping_mode: settings.shipping_mode ?? "Operator",
        default_warehouse: settings.default_warehouse ?? "",
        store_credit_account: settings.store_credit_account ?? "",
        loyalty_enabled: settings.loyalty_enabled ?? 0,
        loyalty_earn_rate: settings.loyalty_earn_rate ?? 0,
        loyalty_redeem_value: settings.loyalty_redeem_value ?? 0,
        loyalty_min_redeem: settings.loyalty_min_redeem ?? 0,
      });
      setSettings(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admSaveErr);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const s = settings;
  const toggle = (key: keyof AdminSettings) =>
    set(key, (s[key] ? 0 : 1) as AdminSettings[keyof AdminSettings]);

  const fieldCls =
    "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  return (
    <div className="max-w-3xl space-y-6">
      <OperatorStats />

      {s.email_configured === false && (
        <Link
          href="/admin/email"
          className="flex items-start gap-2 rounded-xl bg-[#fdf2dd] px-4 py-3 text-sm text-[#854f0b] transition-colors hover:bg-[#fbe9c4]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t.emailNotConfigured} <span className="font-medium underline">{t.admConfigureNow}</span>
          </span>
        </Link>
      )}

      {/* General */}
      <section className="card space-y-5 p-6">
        <div className="flex items-center gap-2 font-medium text-ink">
          <Store className="h-4 w-4 text-blue-600" /> {t.secGeneral}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-ink">{t.fieldMode}</label>
          <div className="flex gap-2">
            {(["Multi Vendor", "Single Company"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("mode", m)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                  s.mode === m
                    ? "border-blue bg-blue text-white"
                    : "border-line text-ink-600 hover:bg-blue-50"
                }`}
              >
                {m === "Multi Vendor" ? t.modeMulti : t.modeSingle}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">{t.fieldCurrency}</label>
            <input
              value={s.default_currency ?? ""}
              onChange={(e) => set("default_currency", e.target.value)}
              className={fieldCls}
              placeholder="EGP"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">{t.fieldCommission}</label>
            <input
              type="number"
              min={0}
              max={100}
              value={s.default_commission_rate ?? 0}
              onChange={(e) => set("default_commission_rate", Number(e.target.value))}
              className={fieldCls}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-ink-400">
          <ShieldCheck className="h-4 w-4" />
          {t.operatorCompany}: <span className="font-medium text-ink">{s.operator_company}</span>
        </div>
      </section>

      {/* Shipping */}
      <section className="card space-y-5 p-6">
        <div className="flex items-center gap-2 font-medium text-ink">
          <Truck className="h-4 w-4 text-blue-600" /> {t.secShipping}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink">{t.shipModeLabel}</label>
          <div className="flex gap-2">
            {(["Operator", "Per Vendor"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("shipping_mode", m)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                  (s.shipping_mode ?? "Operator") === m
                    ? "border-blue bg-blue text-white"
                    : "border-line text-ink-600 hover:bg-blue-50"
                }`}
              >
                {m === "Operator" ? t.shipModeOperator : t.shipModePerVendor}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-400">{t.shipModeHint}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink">{t.fieldDefaultWarehouse}</label>
          <input
            value={s.default_warehouse ?? ""}
            onChange={(e) => set("default_warehouse", e.target.value)}
            className={fieldCls}
            placeholder="Stores - O"
          />
        </div>
      </section>

      {/* Approvals */}
      <section className="card space-y-3 p-6">
        <div className="font-medium text-ink">{t.secApprovals}</div>
        <Toggle label={t.fieldAutoVendors} on={!!s.auto_approve_vendors} onClick={() => toggle("auto_approve_vendors")} />
        <Toggle label={t.fieldAutoProducts} on={!!s.auto_approve_products} onClick={() => toggle("auto_approve_products")} />
      </section>

      {/* Homepage */}
      <section className="card space-y-3 p-6">
        <div className="font-medium text-ink">{t.secHomepageAdmin}</div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink">{t.fieldDeal}</label>
          <select
            value={s.deal_product ?? ""}
            onChange={(e) => set("deal_product", e.target.value || null)}
            className={fieldCls}
          >
            <option value="">{t.dealNone}</option>
            {products.map((p) => (
              <option key={p.name} value={p.name}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Integration */}
      <section className="card space-y-3 p-6">
        <div className="font-medium text-ink">{t.secIntegration}</div>
        <Toggle label={t.fieldSyncWebshop} on={!!s.sync_website_item} onClick={() => toggle("sync_website_item")} />
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink">{t.fieldTaxTemplate}</label>
          <input
            value={s.sales_tax_template ?? ""}
            onChange={(e) => set("sales_tax_template", e.target.value)}
            className={fieldCls}
            placeholder="Ovira VAT 14% - O"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink">{t.fieldStoreCreditAccount}</label>
          <input
            value={s.store_credit_account ?? ""}
            onChange={(e) => set("store_credit_account", e.target.value)}
            className={fieldCls}
            placeholder="Store Credit Liability - O"
          />
          <p className="text-xs text-ink-400">{t.fieldStoreCreditAccountHint}</p>
        </div>
      </section>

      {/* Loyalty */}
      <section className="card space-y-3 p-6">
        <div className="font-medium text-ink">{t.secLoyalty}</div>
        <Toggle label={t.fieldLoyaltyEnabled} on={!!s.loyalty_enabled} onClick={() => toggle("loyalty_enabled")} />
        <p className="text-xs text-ink-400">{t.fieldLoyaltyHint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">{t.fieldLoyaltyEarnRate}</label>
            <input
              type="number"
              min="0"
              step="any"
              value={s.loyalty_earn_rate ?? 0}
              onChange={(e) => set("loyalty_earn_rate", Number(e.target.value))}
              className={fieldCls}
              placeholder="1"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">{t.fieldLoyaltyRedeemValue}</label>
            <input
              type="number"
              min="0"
              step="any"
              value={s.loyalty_redeem_value ?? 0}
              onChange={(e) => set("loyalty_redeem_value", Number(e.target.value))}
              className={fieldCls}
              placeholder="0.01"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">{t.fieldLoyaltyMinRedeem}</label>
            <input
              type="number"
              min="0"
              step="1"
              value={s.loyalty_min_redeem ?? 0}
              onChange={(e) => set("loyalty_min_redeem", Number(e.target.value))}
              className={fieldCls}
              placeholder="0"
            />
          </div>
        </div>
      </section>

      <WhatsAppConfigCard />

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur">
        <div className="ps-2 text-sm">
          {error && (
            <span className="flex items-center gap-1.5 text-coral">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          )}
          {saved && !error && (
            <span className="flex items-center gap-1.5 text-mint">
              <CheckCircle2 className="h-4 w-4" /> {t.savedOk}
            </span>
          )}
        </div>
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-sm text-ink transition-colors hover:bg-blue-50"
    >
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-blue" : "bg-line"}`}>
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ insetInlineStart: on ? "22px" : "2px" }}
        />
      </span>
    </button>
  );
}
