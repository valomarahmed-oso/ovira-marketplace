"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RadioTower,
  Trash2,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  CHANNEL_FIELDS,
  SECRET_LABEL,
  SECRET_MASK,
  deleteSender,
  probeSender,
  upsertSender,
  type HubSender,
  type ProbeResult,
} from "@/lib/messaging-hub";

const fieldCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";

/** One configured sender: its scope, its channel config, its write-only
 *  credential, and the "fetch from the provider" probe. */
export function MessagingSenderCard({
  sender,
  onChanged,
  onRemoved,
}: {
  sender: HubSender;
  onChanged: (next: HubSender) => void;
  onRemoved: (name: string) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<HubSender>(sender);
  const [secret, setSecret] = useState("");
  const [config, setConfig] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(sender.config ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])
    )
  );
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownFields = CHANNEL_FIELDS[sender.channel] ?? [];
  // Anything the operator added by hand that isn't in the known list still shows.
  const extraKeys = Object.keys(config).filter(
    (k) => !knownFields.some((f) => f.key === k)
  );

  function setCfg(key: string, value: string) {
    setConfig((c) => ({ ...c, [key]: value }));
    setSaved(false);
  }

  function set<K extends keyof HubSender>(key: K, value: HubSender[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await upsertSender({
        name: sender.name,
        sender_name: draft.sender_name,
        enabled: draft.enabled ? 1 : 0,
        is_default: draft.is_default ? 1 : 0,
        company: draft.company ?? "",
        app_source: draft.app_source ?? "",
        priority: draft.priority,
        config,
        // Omit entirely unless a fresh credential was typed, so saving other
        // fields never wipes the stored one.
        ...(secret ? { secret } : {}),
      });
      onChanged(next);
      setDraft(next);
      setSecret("");
      setConfig(
        Object.fromEntries(
          Object.entries(next.config ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])
        )
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mhSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function runProbe() {
    setProbing(true);
    setError(null);
    setProbe(null);
    try {
      setProbe(await probeSender(sender.name));
    } catch (err) {
      setProbe({ ok: false, error: err instanceof Error ? err.message : t.mhProbeFailed });
    } finally {
      setProbing(false);
    }
  }

  async function remove() {
    if (!window.confirm(t.mhDeleteConfirm)) return;
    setBusy(true);
    try {
      await deleteSender(sender.name);
      onRemoved(sender.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mhDeleteFailed);
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
            <RadioTower className="h-5 w-5 text-blue-600" />
          </span>
          <div>
            <div className="font-medium text-ink">{draft.sender_name}</div>
            <div className="text-xs text-ink-400">
              {sender.channel_label}
              {draft.is_default ? ` · ${t.mhIsDefault}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              draft.enabled ? "bg-emerald-50 text-emerald-700" : "bg-ink-50 text-ink-500"
            }`}
          >
            {draft.enabled ? t.mhEnabled : t.mhDisabled}
          </span>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            title={t.mhDelete}
            className="rounded-lg p-2 text-ink-400 hover:bg-coral-50 hover:text-coral disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.mhSenderName}</span>
          <input
            value={draft.sender_name}
            onChange={(e) => set("sender_name", e.target.value)}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.mhPriority}</span>
          <input
            type="number"
            dir="ltr"
            value={draft.priority ?? 10}
            onChange={(e) => set("priority", Number(e.target.value))}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.mhCompany}</span>
          <input
            value={draft.company ?? ""}
            onChange={(e) => set("company", e.target.value)}
            placeholder={t.mhAnyCompany}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.mhApp}</span>
          <input
            value={draft.app_source ?? ""}
            onChange={(e) => set("app_source", e.target.value)}
            placeholder={t.mhAnyApp}
            dir="ltr"
            className={fieldCls}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={!!draft.enabled}
            onChange={(e) => set("enabled", e.target.checked ? 1 : 0)}
            className="h-4 w-4 accent-blue"
          />
          {t.mhEnabled}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={!!draft.is_default}
            onChange={(e) => set("is_default", e.target.checked ? 1 : 0)}
            className="h-4 w-4 accent-blue"
          />
          {t.mhIsDefault}
        </label>
      </div>

      {(knownFields.length > 0 || extraKeys.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {knownFields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block text-ink-400">{f.key}</span>
              <input
                value={config[f.key] ?? ""}
                onChange={(e) => setCfg(f.key, e.target.value)}
                placeholder={f.placeholder}
                dir="ltr"
                className={fieldCls}
              />
            </label>
          ))}
          {extraKeys.map((key) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block text-ink-400">{key}</span>
              <input
                value={config[key] ?? ""}
                onChange={(e) => setCfg(key, e.target.value)}
                dir="ltr"
                className={fieldCls}
              />
            </label>
          ))}
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-ink-400">
          {SECRET_LABEL[sender.channel] ?? t.mhSecret}
        </span>
        <input
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={secret}
          onChange={(e) => {
            setSecret(e.target.value);
            setSaved(false);
          }}
          placeholder={draft.has_secret ? t.mhSecretStored : t.mhSecretUnset}
          className={fieldCls}
        />
        <span className="mt-1 block text-xs text-ink-400">{t.mhSecretHint}</span>
      </label>

      {draft.masked_config_keys?.length > 0 && (
        <p className="rounded-xl bg-[#fdf2dd] px-3 py-2 text-xs text-[#854f0b]">
          {t.mhMaskedNote} {draft.masked_config_keys.join("، ")} — {SECRET_MASK}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.mhSave}
        </button>
        {sender.can_probe && (
          <button
            type="button"
            onClick={runProbe}
            disabled={probing}
            className="btn btn-ghost border border-line disabled:opacity-50"
          >
            {probing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RadioTower className="h-4 w-4" />
            )}
            {probing ? t.mhProbing : t.mhProbe}
          </button>
        )}
        {saved && !error && (
          <span className="flex items-center gap-1.5 text-sm text-mint">
            <CheckCircle2 className="h-4 w-4" /> {t.savedOk}
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1.5 text-sm text-coral">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
        )}
      </div>

      {probe && <ProbePanel probe={probe} />}
    </div>
  );
}

/** What the provider reported about itself. Never contains a credential. */
function ProbePanel({ probe }: { probe: ProbeResult }) {
  const { t } = useI18n();

  if (!probe.ok) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{probe.unsupported ? t.mhProbeUnsupported : probe.error ?? t.mhProbeFailed}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-ink-50/60 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <CheckCircle2 className="h-4 w-4 text-mint" />
        {t.mhProbeOk}
        {probe.summary && <span className="text-ink-400">· {probe.summary}</span>}
      </div>

      {probe.sessions && probe.sessions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-xs text-ink-400">
                <th className="p-2 text-start font-medium">{t.mhSession}</th>
                <th className="p-2 text-start font-medium">{t.mhStatus}</th>
                <th className="p-2 text-start font-medium">{t.mhNumber}</th>
                <th className="p-2 text-start font-medium">{t.mhDisplayName}</th>
              </tr>
            </thead>
            <tbody>
              {probe.sessions.map((s) => (
                <tr key={s.session ?? Math.random()} className="border-t border-line">
                  <td className="p-2 font-tech" dir="ltr">
                    {s.session ?? "—"}
                  </td>
                  <td className="p-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.connected
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[#fdf2dd] text-[#854f0b]"
                      }`}
                    >
                      {s.status ?? "—"}
                    </span>
                  </td>
                  <td className="p-2 font-tech" dir="ltr">
                    {s.number ?? "—"}
                  </td>
                  <td className="p-2">{s.display_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {probe.sessions && probe.sessions.length === 0 && (
        <p className="text-sm text-ink-400">{t.mhNoSessions}</p>
      )}

      {probe.bot && (
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <Row label={t.mhBotUsername} value={probe.bot.username ? `@${probe.bot.username}` : "—"} />
          <Row label={t.mhBotName} value={probe.bot.name ?? "—"} />
        </dl>
      )}

      {probe.number && (
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <Row label={t.mhVerifiedName} value={probe.number.verified_name ?? "—"} />
          <Row label={t.mhNumber} value={probe.number.display_phone_number ?? "—"} />
          <Row label={t.mhQuality} value={probe.number.quality_rating ?? "—"} />
        </dl>
      )}

      {probe.smtp && (
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <Row label="host" value={`${probe.smtp.host ?? "—"}:${probe.smtp.port ?? "—"}`} />
          <Row
            label={t.mhAuthenticated}
            value={probe.smtp.authenticated ? t.mhYes : t.mhNo}
          />
        </dl>
      )}

      {probe.account && (
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <Row label={t.mhAccountName} value={probe.account.friendly_name ?? "—"} />
          <Row label={t.mhStatus} value={probe.account.status ?? "—"} />
        </dl>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 py-1">
      <dt className="text-ink-400">{label}</dt>
      <dd className="font-tech text-ink" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
