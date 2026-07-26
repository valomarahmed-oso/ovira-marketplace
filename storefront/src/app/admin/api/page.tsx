"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  createApiKey,
  deleteApiKey,
  getApiOverview,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  type ApiKeyRow,
  type ApiOverview,
  type ApiScope,
  type NewKey,
} from "@/lib/api-access";

const fieldCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";

const SCOPES: ApiScope[] = ["Read Only", "Content Editor", "Operator"];

/** Operator console for external API credentials, so integrating a mobile app
 *  or a partner service never needs the ERPNext Desk. */
export default function AdminApiPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<ApiKeyRow[]>([]);
  const [overview, setOverview] = useState<ApiOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<(NewKey & { label: string }) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [keys, ov] = await Promise.all([listApiKeys(), getApiOverview()]);
    setRows(keys);
    setOverview(ov);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  const scopeLabel: Record<ApiScope, string> = {
    "Read Only": t.akScopeRead,
    "Content Editor": t.akScopeContent,
    Operator: t.akScopeOperator,
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.akTitle}</h2>
        <p className="text-sm text-ink-400">{t.akSubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {fresh && <FreshKeyCard fresh={fresh} onDismiss={() => setFresh(null)} />}

      {overview && <OverviewCard overview={overview} />}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <NewKeyForm
            onCreated={(res, label) => {
              setRows((r) => [res.created, ...r]);
              setFresh({ ...res, label });
            }}
            onError={setError}
          />

          <section className="space-y-3">
            <h3 className="font-medium text-ink">{t.akIssued}</h3>
            {rows.length === 0 ? (
              <div className="card p-6 text-center text-sm text-ink-400">{t.akNone}</div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <KeyCard
                    key={row.name}
                    row={row}
                    scopeLabel={scopeLabel[row.scope] ?? row.scope}
                    onRows={setRows}
                    onRotated={(nk) => setFresh({ ...nk, label: row.label })}
                    onError={setError}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** The one and only time the secret is visible. */
function FreshKeyCard({
  fresh,
  onDismiss,
}: {
  fresh: NewKey & { label: string };
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="card space-y-3 border-2 border-blue p-5">
      <div className="flex items-center gap-2 font-medium text-ink">
        <KeyRound className="h-5 w-5 text-blue-600" />
        {fresh.label}
      </div>
      <p className="rounded-xl bg-[#fdf2dd] px-3 py-2 text-xs text-[#854f0b]">{t.akCopyNow}</p>
      <CopyRow label="api_key" value={fresh.api_key} />
      <CopyRow label="api_secret" value={fresh.api_secret} />
      <CopyRow
        label={t.akHeader}
        value={`Authorization: token ${fresh.api_key}:${fresh.api_secret}`}
      />
      <button type="button" onClick={onDismiss} className="btn btn-ghost text-sm">
        {t.akDone}
      </button>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1 text-xs text-ink-400">{label}</div>
      <div className="flex items-center gap-2">
        <code
          dir="ltr"
          className="flex-1 overflow-x-auto rounded-xl bg-ink-50 px-3 py-2 font-tech text-xs text-ink"
        >
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-lg border border-line p-2 text-ink-400 hover:text-blue-600"
        >
          {copied ? <Check className="h-4 w-4 text-mint" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function OverviewCard({ overview }: { overview: ApiOverview }) {
  const { t } = useI18n();
  return (
    <section className="card space-y-3 p-5">
      <div className="font-medium text-ink">{t.akHowTo}</div>
      <p className="text-xs text-ink-400">{overview.guest_note}</p>
      <CopyRow label={t.akEndpointShape} value={overview.method_url} />
      <CopyRow label={t.akHeader} value={overview.auth_header} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-xs text-ink-400">
              <th className="p-2 text-start font-medium">{t.akExample}</th>
              <th className="p-2 text-start font-medium">{t.akMethod}</th>
              <th className="p-2 text-start font-medium">{t.akNeedsKey}</th>
            </tr>
          </thead>
          <tbody>
            {overview.examples.map((ex) => (
              <tr key={ex.method} className="border-t border-line">
                <td className="p-2">{ex.label}</td>
                <td className="p-2 font-tech text-xs" dir="ltr">
                  {ex.method}
                </td>
                <td className="p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ex.auth ? "bg-[#fdf2dd] text-[#854f0b]" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {ex.auth ? t.akYes : t.akNo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewKeyForm({
  onCreated,
  onError,
}: {
  onCreated: (res: { created: ApiKeyRow } & NewKey, label: string) => void;
  onError: (m: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<ApiScope>("Read Only");
  const [busy, setBusy] = useState(false);

  const scopeLabel: Record<ApiScope, string> = {
    "Read Only": t.akScopeRead,
    "Content Editor": t.akScopeContent,
    Operator: t.akScopeOperator,
  };

  async function create() {
    if (!label.trim()) return;
    setBusy(true);
    onError(null);
    try {
      const res = await createApiKey({ label: label.trim(), scope });
      onCreated(res, label.trim());
      setLabel("");
      setOpen(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : t.akCreateFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost border border-line">
        <Plus className="h-4 w-4" />
        {t.akNew}
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="font-medium text-ink">{t.akNew}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.akLabel}</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.akLabelPlaceholder}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.akScope}</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ApiScope)}
            className={fieldCls}
          >
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {scopeLabel[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-ink-400">{t.akScopeHint}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={create}
          disabled={busy || !label.trim()}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.akCreate}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost text-sm">
          {t.mhCancel}
        </button>
      </div>
    </div>
  );
}

function KeyCard({
  row,
  scopeLabel,
  onRows,
  onRotated,
  onError,
}: {
  row: ApiKeyRow;
  scopeLabel: string;
  onRows: (rows: ApiKeyRow[]) => void;
  onRotated: (nk: NewKey) => void;
  onError: (m: string | null) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    onError(null);
    try {
      await fn();
    } catch (err) {
      onError(err instanceof Error ? err.message : t.akCreateFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{row.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.enabled ? "bg-emerald-50 text-emerald-700" : "bg-ink-50 text-ink-500"
            }`}
          >
            {row.enabled ? t.akActive : t.akRevoked}
          </span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
            {scopeLabel}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-400">
          <span className="font-tech" dir="ltr">
            {row.key_prefix}…
          </span>
          <span>
            {t.akLastUsed}: {row.last_used ? row.last_used.slice(0, 16) : t.akNever}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => act(async () => onRotated(await rotateApiKey(row.name)))}
          className="btn btn-ghost h-9 border border-line text-sm disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          {t.akRotate}
        </button>
        {row.enabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              window.confirm(t.akRevokeConfirm) &&
              act(async () => onRows(await revokeApiKey(row.name)))
            }
            className="btn btn-ghost h-9 border border-line text-sm disabled:opacity-50"
          >
            {t.akRevoke}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            window.confirm(t.akDeleteConfirm) &&
            act(async () => onRows(await deleteApiKey(row.name)))
          }
          title={t.akDelete}
          className="rounded-lg p-2 text-ink-400 hover:bg-coral-50 hover:text-coral disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
