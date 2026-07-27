"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  listNotificationEvents,
  listOutbox,
  previewTemplate,
  resetTemplate,
  retryOutbox,
  saveTemplate,
  type NotificationEvent,
  type OutboxRow,
  type Preview,
} from "@/lib/notifications-admin";

const fieldCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-blue";

/** Operator console for the notification pipeline.
 *
 *  Two questions, two tabs: *what does the customer read?* and *did it actually
 *  arrive?* The event catalogue is owned by the backend — this edits wording on
 *  top of it, so a new event ships working and an edit survives an upgrade.
 */
export default function AdminNotificationsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const [tab, setTab] = useState<"templates" | "outbox">("templates");

  if (!ready) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!user?.isOperator) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.nfTitle}</h2>
        <p className="text-sm text-ink-400">{t.nfSubtitle}</p>
      </div>

      <div className="flex gap-2">
        {(["templates", "outbox"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === k ? "bg-blue-600 text-white" : "border border-line text-ink hover:bg-line/30"
            }`}
          >
            {k === "templates" ? t.nfTabTemplates : t.nfTabOutbox}
          </button>
        ))}
      </div>

      {tab === "templates" ? <TemplatesTab /> : <OutboxTab />}
    </div>
  );
}

// ── wording ─────────────────────────────────────────────────────────────────
function TemplatesTab() {
  const { t } = useI18n();
  const [events, setEvents] = useState<NotificationEvent[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => setEvents(await listNotificationEvents()), []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!events) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((ev) => (
        <div key={ev.event} className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen(open === ev.event ? null : ev.event)}
            className="flex w-full flex-wrap items-center gap-3 p-4 text-start"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{ev.languages.ar.title || ev.languages.ar.default_title}</div>
              <div className="text-xs text-ink-400">
                <code>{ev.event}</code> · {ev.channels.join(" · ")}
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                ev.transactional ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {ev.transactional ? t.nfTransactional : t.nfMarketing}
            </span>
            <span className="rounded-full bg-line/40 px-2.5 py-1 text-[11px] text-ink-400">
              {ev.audience === "buyer"
                ? t.nfAudienceBuyer
                : ev.audience === "vendor"
                  ? t.nfAudienceVendor
                  : t.nfAudienceOperator}
            </span>
            {(ev.languages.ar.overridden || ev.languages.en.overridden) && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                {t.nfCustom}
              </span>
            )}
          </button>

          {open === ev.event && (
            <div className="space-y-4 border-t border-line p-4">
              {!ev.transactional && (
                <p className="text-xs text-ink-400">{t.nfTransactionalHint}</p>
              )}
              <LanguageEditor event={ev} lang="ar" onSaved={load} />
              <LanguageEditor event={ev} lang="en" onSaved={load} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LanguageEditor({
  event,
  lang,
  onSaved,
}: {
  event: NotificationEvent;
  lang: "ar" | "en";
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const block = event.languages[lang];
  const [title, setTitle] = useState(block.title || block.default_title);
  const [lines, setLines] = useState((block.lines.length ? block.lines : block.default_lines).join("\n"));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // Which {placeholders} this event's shipped wording uses — the honest list,
  // rather than a generic one that invites typos into a live message.
  const placeholders = useMemo(() => {
    const found = new Set<string>();
    [block.default_title, ...block.default_lines].forEach((s) =>
      [...String(s).matchAll(/\{(\w+)\}/g)].forEach((m) => found.add(m[1]))
    );
    return [...found];
  }, [block.default_title, block.default_lines]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await fn();
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">
          {lang === "ar" ? t.nfEditAr : t.nfEditEn}
        </span>
        {block.overridden && <span className="text-[11px] text-emerald-700">{t.nfCustom}</span>}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-ink-400">{t.nfTitleField}</span>
        <input
          className={fieldCls}
          value={title}
          dir={lang === "ar" ? "rtl" : "ltr"}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-ink-400">{t.nfLinesField}</span>
        <textarea
          className={`${fieldCls} min-h-24`}
          value={lines}
          dir={lang === "ar" ? "rtl" : "ltr"}
          onChange={(e) => setLines(e.target.value)}
        />
      </label>

      {placeholders.length > 0 && (
        <p className="text-xs text-ink-400">
          {t.nfPlaceholders}:{" "}
          {placeholders.map((p) => (
            <code key={p} className="mx-0.5 rounded bg-line/40 px-1">{`{${p}}`}</code>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(() =>
              saveTemplate({
                event: event.event,
                language: lang,
                title,
                lines: lines.split("\n").filter((l) => l.trim()),
              })
            )
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t.nfSaveText}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setPreview(
              await previewTemplate({
                event: event.event,
                language: lang,
                title,
                lines: lines.split("\n").filter((l) => l.trim()),
              })
            );
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-ink"
        >
          <Eye className="h-4 w-4" /> {t.nfPreview}
        </button>

        {block.overridden && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await resetTemplate(event.event, lang);
                setTitle(block.default_title);
                setLines(block.default_lines.join("\n"));
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-400 hover:bg-line/30"
          >
            <RotateCcw className="h-4 w-4" /> {t.nfResetText}
          </button>
        )}

        {saved && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        {error && (
          <span className="flex items-center gap-1 text-sm text-coral">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
        )}
      </div>

      {preview && (
        <div
          className="rounded-xl bg-line/20 p-3 text-sm"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <div className="font-medium text-ink">{preview.title}</div>
          {preview.lines.map((l, i) => (
            <p key={i} className="text-ink-400">
              {l}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── delivery log ────────────────────────────────────────────────────────────
function OutboxTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OutboxRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await listOutbox({ limit: 80, status: status || undefined }));
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (name: string) => {
    setBusy(name);
    try {
      await retryOutbox(name);
    } catch {
      /* the reload shows the outcome */
    }
    await load();
    setBusy(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-xl border border-line bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t.nfAllStatuses}</option>
          <option value="sent">{t.nfStatusSent}</option>
          <option value="failed">{t.nfStatusFailed}</option>
          <option value="skipped">{t.nfStatusSkipped}</option>
          <option value="queued">{t.nfStatusQueued}</option>
          <option value="retry">{t.nfStatusRetry}</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-ink"
        >
          <RefreshCw className="h-4 w-4" /> {t.mhRefresh}
        </button>
      </div>

      {!rows ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-ink-400">{t.nfOutboxEmpty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="card flex flex-wrap items-start gap-3 p-4">
              <StatusIcon status={r.status} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">{r.subject || r.event}</div>
                <div className="text-xs text-ink-400">
                  <code>{r.event}</code> · {r.channel} · {r.recipient}
                  {r.attempts > 0 && ` · ${r.attempts} ${t.nfAttempts}`}
                </div>
                {r.last_error && (
                  <p className="mt-1 break-words text-xs text-coral">{r.last_error}</p>
                )}
              </div>
              <span className="whitespace-nowrap text-[11px] text-ink-400">
                {r.creation.slice(0, 16)}
              </span>
              {(r.status === "failed" || r.status === "skipped") && (
                <button
                  type="button"
                  disabled={busy === r.name}
                  onClick={() => void retry(r.name)}
                  className="rounded-xl border border-line px-2.5 py-1.5 text-xs text-ink disabled:opacity-50"
                >
                  {busy === r.name ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    t.nfRetryNow
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: OutboxRow["status"] }) {
  if (status === "sent") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "failed") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />;
  if (status === "skipped") return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />;
  return <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
}
