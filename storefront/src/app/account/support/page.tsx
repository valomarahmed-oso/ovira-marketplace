"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, LifeBuoy, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { StatusChip, SupportThread, useCategoryLabels } from "@/components/support-thread";
import {
  TICKET_CATEGORIES,
  createTicket,
  myTickets,
  type Ticket,
  type TicketCategory,
} from "@/lib/support-api";

const fieldCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";

/** Buyer support centre — reach the store itself, not a vendor. */
export default function AccountSupportPage() {
  const { t } = useI18n();
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);

  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await myTickets());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    void load();
  }, [ready, user, load]);

  const categoryLabel = useCategoryLabels();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-medium text-ink">
            <LifeBuoy className="h-5 w-5 text-blue-600" />
            {t.supTitle}
          </h2>
          <p className="text-sm text-ink-400">{t.supSubtitle}</p>
        </div>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {t.supNew}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {composing && (
        <NewTicketForm
          onCreated={(name) => {
            setComposing(false);
            setOpen(name);
            void load();
          }}
          onCancel={() => setComposing(false)}
          onError={setError}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-400">{t.supEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((tk) => (
            <div key={tk.name} className="card p-4">
              <button
                type="button"
                onClick={() => setOpen(open === tk.name ? null : tk.name)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-start"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{tk.subject}</span>
                    {tk.unread > 0 && (
                      <span className="rounded-full bg-coral px-1.5 py-0.5 text-[11px] font-medium text-white">
                        {tk.unread}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-400">
                    <span className="font-tech" dir="ltr">
                      {tk.name}
                    </span>
                    <span>{categoryLabel[tk.category] ?? tk.category}</span>
                    {tk.order && (
                      <span className="font-tech" dir="ltr">
                        {tk.order}
                      </span>
                    )}
                    <span>{tk.last_activity.slice(0, 16)}</span>
                  </div>
                </div>
                <StatusChip status={tk.status} />
              </button>

              {open === tk.name && (
                <div className="mt-4 border-t border-line pt-4">
                  <SupportThread name={tk.name} onStatusChange={() => void load()} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewTicketForm({
  onCreated,
  onCancel,
  onError,
}: {
  onCreated: (name: string) => void;
  onCancel: () => void;
  onError: (m: string | null) => void;
}) {
  const { t } = useI18n();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("Other");
  const [order, setOrder] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const categoryLabel = useCategoryLabels();

  async function submit() {
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    onError(null);
    try {
      const res = await createTicket({
        subject: subject.trim(),
        body: body.trim(),
        category,
        ...(order.trim() ? { order: order.trim() } : {}),
      });
      onCreated(res.name);
    } catch (err) {
      onError(err instanceof Error ? err.message : t.supCreateFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="font-medium text-ink">{t.supNew}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.supSubject}</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t.supSubjectPlaceholder}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.supCategory}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className={fieldCls}
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-ink-400">{t.supOrderOptional}</span>
          <input
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="ORD-0001"
            dir="ltr"
            className={fieldCls}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-ink-400">{t.supMessage}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={t.supMessagePlaceholder}
          className="w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-blue"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !subject.trim() || !body.trim()}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.supSubmit}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost text-sm">
          {t.mhCancel}
        </button>
      </div>
    </div>
  );
}
