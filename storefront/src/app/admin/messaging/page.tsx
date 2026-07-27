"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { MessagingSenderCard } from "@/components/messaging-sender-card";
import { MessagingImport } from "@/components/messaging-import";
import { MessagingGuide } from "@/components/messaging-guide";
import {
  getHubStatus,
  getMessageLog,
  listSenders,
  sendTest,
  upsertSender,
  type HubLogRow,
  type HubSender,
  type HubStatus,
  type TestSendResult,
} from "@/lib/messaging-hub";

const fieldCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";

/** Operator console for the shared Ovira Messaging Hub: which senders exist,
 *  whether each provider is actually reachable, a test send, and the delivery
 *  log across every app on the hub. Credentials are never read back. */
export default function AdminMessagingPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [status, setStatus] = useState<HubStatus | null>(null);
  const [senders, setSenders] = useState<HubSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const st = await getHubStatus();
    setStatus(st);
    setSenders(st?.installed ? await listSenders() : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.mhTitle}</h2>
        <p className="text-sm text-ink-400">{t.mhSubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {!status?.installed ? (
        <div className="card space-y-2 p-6">
          <div className="flex items-center gap-2 font-medium text-ink">
            <Info className="h-5 w-5 text-blue-600" />
            {t.mhNotInstalled}
          </div>
          <p className="text-sm text-ink-400">{t.mhNotInstalledHint}</p>
        </div>
      ) : (
        <>
          <StatusCard status={status} onReload={load} />

          {/* Import first: on a fresh store the fastest path to a working channel
              is copying what the server already has, not typing credentials. */}
          <MessagingImport onImported={load} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-ink">{t.mhSenders}</h3>
              <span className="text-xs text-ink-400">
                {status.enabled_senders} / {status.senders} {t.mhEnabled}
              </span>
            </div>

            {senders.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-sm text-ink-400">{t.mhNoSenders}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {senders.map((s) => (
                  <MessagingSenderCard
                    key={s.name}
                    sender={s}
                    onChanged={(next) =>
                      setSenders((prev) =>
                        prev.map((p) => (p.name === next.name ? next : p))
                      )
                    }
                    onRemoved={(name) => {
                      setSenders((prev) => prev.filter((p) => p.name !== name));
                      void load();
                    }}
                  />
                ))}
              </div>
            )}

            <AddSenderCard
              channels={status.channels}
              onCreated={(s) => {
                setSenders((prev) => [...prev, s]);
                void load();
              }}
              onError={setError}
            />
          </section>

          <TestSendCard senders={senders} />
          <MessageLogCard channels={status.channels} />
          <MessagingGuide />
        </>
      )}
    </div>
  );
}

function StatusCard({ status, onReload }: { status: HubStatus; onReload: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-mint" />
          <span className="font-medium text-ink">{t.mhConnected}</span>
        </div>
        <button type="button" onClick={onReload} className="btn btn-ghost h-9 text-sm">
          <RefreshCw className="h-4 w-4" />
          {t.mhRefresh}
        </button>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.mhStatChannels} value={String(status.channels.length)} />
        <Stat label={t.mhStatSenders} value={`${status.enabled_senders}/${status.senders}`} />
        <Stat label={t.mhStatFallback} value={status.fallback_family_order ?? "—"} />
        <Stat
          label={t.mhStatLogging}
          value={status.enable_logging ? t.mhYes : t.mhNo}
        />
      </div>
      {status.live_families && status.live_families.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-400">{t.mhLiveFamilies}</span>
          {status.live_families.map((f) => (
            <span
              key={f}
              className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50/60 px-3 py-2">
      <div className="text-xs text-ink-400">{label}</div>
      <div className="truncate font-tech text-ink" dir="ltr" title={value}>
        {value}
      </div>
    </div>
  );
}

function AddSenderCard({
  channels,
  onCreated,
  onError,
}: {
  channels: HubStatus["channels"];
  onCreated: (s: HubSender) => void;
  onError: (msg: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState(channels[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || !channel) return;
    setBusy(true);
    onError(null);
    try {
      const created = await upsertSender({
        sender_name: name.trim(),
        channel,
        enabled: 0,
        // Blank scope = serves every company and every app until narrowed.
        app_source: "",
        priority: 10,
      });
      onCreated(created);
      setName("");
      setOpen(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : t.mhSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost border border-line">
        <Plus className="h-4 w-4" />
        {t.mhAddSender}
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="font-medium text-ink">{t.mhAddSender}</div>
      <p className="text-xs text-ink-400">{t.mhAddSenderHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.mhSenderName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.mhSenderNamePlaceholder}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.mhChannel}</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={fieldCls}>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={create}
          disabled={busy || !name.trim()}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.mhCreate}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost text-sm">
          {t.mhCancel}
        </button>
      </div>
    </div>
  );
}

function TestSendCard({ senders }: { senders: HubSender[] }) {
  const { t } = useI18n();
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestSendResult | null>(null);

  const usable = senders.filter((s) => s.enabled);

  async function run() {
    if (!recipient.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await sendTest({
          recipient: recipient.trim(),
          body: body.trim() || undefined,
          sender: sender || undefined,
        })
      );
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : t.mhTestFailed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Send className="h-5 w-5 text-blue-600" />
        <div className="font-medium text-ink">{t.mhTest}</div>
      </div>
      <p className="text-xs text-ink-400">{t.mhTestHint}</p>

      {usable.length === 0 ? (
        <p className="rounded-xl bg-[#fdf2dd] px-3 py-2 text-xs text-[#854f0b]">
          {t.mhTestNoSender}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-ink-400">{t.mhTestVia}</span>
              <select value={sender} onChange={(e) => setSender(e.target.value)} className={fieldCls}>
                <option value="">{t.mhTestAuto}</option>
                {usable.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.sender_name} — {s.channel_label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-ink-400">{t.mhTestRecipient}</span>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={t.mhTestRecipientPlaceholder}
                dir="ltr"
                className={fieldCls}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-400">{t.mhTestBody}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder={t.mhTestBodyPlaceholder}
              className="w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-blue"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={busy || !recipient.trim()}
              className="btn btn-primary disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.mhTestSend}
            </button>
            {result &&
              (result.ok ? (
                <span className="flex items-center gap-1.5 text-sm text-mint">
                  <CheckCircle2 className="h-4 w-4" />
                  {t.mhTestSent}
                  {result.sender ? ` · ${result.sender}` : ""}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-coral">
                  <XCircle className="h-4 w-4" />
                  {result.error ?? t.mhTestFailed}
                </span>
              ))}
          </div>
        </>
      )}
    </section>
  );
}

function MessageLogCard({ channels }: { channels: HubStatus["channels"] }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<HubLogRow[]>([]);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [appOnly, setAppOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(
      await getMessageLog({
        limit: 50,
        status: status || undefined,
        channel: channel || undefined,
        app_only: appOnly ? 1 : 0,
      })
    );
    setLoading(false);
  }, [status, channel, appOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const chip = (s: string) =>
    s === "sent"
      ? "bg-emerald-50 text-emerald-700"
      : s === "failed"
        ? "bg-coral-50 text-coral"
        : "bg-ink-50 text-ink-500";

  return (
    <section className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-medium text-ink">{t.mhLog}</div>
        <button type="button" onClick={load} className="btn btn-ghost h-9 text-sm">
          <RefreshCw className="h-4 w-4" />
          {t.mhRefresh}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${fieldCls} w-auto`}>
          <option value="">{t.mhLogAllStatuses}</option>
          <option value="sent">{t.mhLogSent}</option>
          <option value="failed">{t.mhLogFailed}</option>
          <option value="queued">{t.mhLogQueued}</option>
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={`${fieldCls} w-auto`}>
          <option value="">{t.mhLogAllChannels}</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={appOnly}
            onChange={(e) => setAppOnly(e.target.checked)}
            className="h-4 w-4 accent-blue"
          />
          {t.mhLogAppOnly}
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">{t.mhLogEmpty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-xs text-ink-400">
                <th className="p-2 text-start font-medium">{t.mhLogWhen}</th>
                <th className="p-2 text-start font-medium">{t.mhChannel}</th>
                <th className="p-2 text-start font-medium">{t.mhLogRecipient}</th>
                <th className="p-2 text-start font-medium">{t.mhLogApp}</th>
                <th className="p-2 text-start font-medium">{t.mhStatus}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-line align-top">
                  <td className="whitespace-nowrap p-2 font-tech text-xs text-ink-400" dir="ltr">
                    {r.creation.slice(0, 16)}
                  </td>
                  <td className="p-2 font-tech text-xs" dir="ltr">
                    {r.channel}
                  </td>
                  <td className="p-2 font-tech text-xs" dir="ltr">
                    {r.recipient}
                  </td>
                  <td className="p-2 font-tech text-xs" dir="ltr">
                    {r.app_source ?? "—"}
                  </td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip(r.status)}`}>
                      {r.status}
                    </span>
                    {r.error && (
                      <div className="mt-1 max-w-[240px] text-xs text-coral">{r.error}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
