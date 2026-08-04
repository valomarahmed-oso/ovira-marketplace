"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getWhatsAppConfig, updateWhatsAppConfig, type WhatsAppConfig } from "@/lib/admin";

const fieldCls =
  "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

/**
 * SUPERSEDED — kept visible, deliberately, rather than deleted.
 *
 * WhatsApp now goes through the messaging gateway: `send_whatsapp` in
 * `notifications/channels.py` calls `_via_hub("whatsapp", …)` and **never
 * reads these fields**. The only code that still touches them is this screen
 * reading back its own values, so a store that fills them in gets silence.
 *
 * Not deleted because an operator has credentials stored here and removing the
 * card would take them with it — and because a settings block that vanishes is
 * a worse answer than one that says where the setting went. It now says so, in
 * the card, with a link.
 */
export function WhatsAppConfigCard() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<WhatsAppConfig | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);

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
      {/* The honest headline. These fields decide nothing any more, and an
          operator filling them in and getting silence is the failure this
          replaces. */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-medium">{t.waSuperseded}</p>
        <p className="mt-1 text-xs leading-relaxed">{t.waSupersededBody}</p>
        <Link href="/admin/messaging" className="mt-2 inline-block text-xs font-medium underline">
          {t.waGoToGateway}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setShowLegacy((v) => !v)}
        className="text-xs text-ink-400 underline"
      >
        {showLegacy ? t.waHideLegacy : t.waShowLegacy}
      </button>

      {showLegacy && (
      <>
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
      </>
      )}
    </section>
  );
}
