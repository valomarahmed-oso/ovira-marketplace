"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getWhatsAppConfig, updateWhatsAppConfig, type WhatsAppConfig } from "@/lib/admin";

const fieldCls =
  "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

/** Operator card to configure gated WhatsApp Business API notifications. The
 *  access token is write-only — we only show whether one is stored. */
export function WhatsAppConfigCard() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<WhatsAppConfig | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWhatsAppConfig().then(setCfg);
  }, []);

  function set<K extends keyof WhatsAppConfig>(key: K, value: WhatsAppConfig[K]) {
    setCfg((c) => (c ? { ...c, [key]: value } : c));
    setSaved(false);
  }

  async function save() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await updateWhatsAppConfig({
        enabled: cfg.enabled ? 1 : 0,
        api_base: cfg.api_base ?? "",
        phone_number_id: cfg.phone_number_id ?? "",
        default_country_code: cfg.default_country_code ?? "",
        template_order_confirmation: cfg.template_order_confirmation ?? "",
        template_order_status: cfg.template_order_status ?? "",
        template_return_update: cfg.template_return_update ?? "",
        template_delivery_otp: cfg.template_delivery_otp ?? "",
        template_lang: cfg.template_lang ?? "",
        ...(token ? { access_token: token } : {}),
      });
      setCfg(next);
      setToken("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return null;

  return (
    <section className="card space-y-3 p-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-emerald-600" />
        <div className="font-medium text-ink">{t.waTitle}</div>
        <span
          className={`ms-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
            cfg.configured ? "bg-emerald-50 text-emerald-700" : "bg-ink-50 text-ink-500"
          }`}
        >
          {cfg.configured ? t.waActive : t.waInactive}
        </span>
      </div>
      <p className="text-xs text-ink-400">{t.waHint}</p>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={!!cfg.enabled}
          onChange={(e) => set("enabled", e.target.checked ? 1 : 0)}
          className="accent-blue"
        />
        {t.waEnable}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={cfg.phone_number_id ?? ""}
          onChange={(e) => set("phone_number_id", e.target.value)}
          className={fieldCls}
          placeholder={t.waPhoneId}
        />
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className={fieldCls}
          type="password"
          autoComplete="off"
          placeholder={cfg.has_token ? t.waTokenStored : t.waToken}
        />
        <input
          value={cfg.default_country_code ?? ""}
          onChange={(e) => set("default_country_code", e.target.value)}
          className={fieldCls}
          placeholder={t.waCountryCode}
        />
        <input
          value={cfg.template_lang ?? ""}
          onChange={(e) => set("template_lang", e.target.value)}
          className={fieldCls}
          placeholder={t.waLang}
        />
        <input
          value={cfg.template_order_confirmation ?? ""}
          onChange={(e) => set("template_order_confirmation", e.target.value)}
          className={fieldCls}
          placeholder={t.waTplConfirm}
        />
        <input
          value={cfg.template_order_status ?? ""}
          onChange={(e) => set("template_order_status", e.target.value)}
          className={fieldCls}
          placeholder={t.waTplStatus}
        />
        <input
          value={cfg.template_return_update ?? ""}
          onChange={(e) => set("template_return_update", e.target.value)}
          className={fieldCls}
          placeholder={t.waTplReturn}
        />
        <input
          value={cfg.template_delivery_otp ?? ""}
          onChange={(e) => set("template_delivery_otp", e.target.value)}
          className={fieldCls}
          placeholder={t.waTplDelivery}
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.waSave}
        </button>
        {saved && !error && (
          <span className="flex items-center gap-1.5 text-sm text-mint">
            <CheckCircle2 className="h-4 w-4" /> {t.savedOk}
          </span>
        )}
        {error && <span className="text-sm text-coral">{error}</span>}
      </div>
    </section>
  );
}
