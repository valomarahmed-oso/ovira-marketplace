"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  getTicket,
  replyToTicket,
  setTicketStatus,
  type TicketMessage,
  type TicketStatus,
  type TicketThread as Thread,
} from "@/lib/support-api";

/** One support conversation, shared by the buyer and operator screens. The
 *  backend decides the caller's role, so the same component serves both. */
export function SupportThread({
  name,
  onStatusChange,
}: {
  name: string;
  onStatusChange?: (status: TicketStatus) => void;
}) {
  const { t } = useI18n();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void getTicket(name).then((data) => {
      if (!alive || !data) return;
      setThread(data);
      setMessages(data.messages);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await replyToTicket(name, text);
      setMessages((m) => [...m, msg]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.supSendFailed);
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    try {
      await setTicketStatus(name, status);
      setThread((tr) => (tr ? { ...tr, ticket: { ...tr.ticket, status } } : tr));
      onStatusChange?.(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.supSendFailed);
    }
  }

  if (!thread) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  const isSupport = thread.role === "support";
  const closed = thread.ticket.status === "Closed";

  return (
    <div className="space-y-3">
      <div className="max-h-[26rem] space-y-2 overflow-y-auto rounded-xl bg-ink-50/50 p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">{t.supNoMessages}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.mine ? "bg-blue text-white" : "bg-white text-ink shadow-sm"
                }`}
              >
                <div
                  className={`mb-0.5 text-[11px] ${m.mine ? "text-white/70" : "text-ink-400"}`}
                >
                  {m.sender_name} · {m.date.slice(0, 16)}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={closed ? t.supReopenHint : t.supReplyPlaceholder}
          className="flex-1 rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-blue"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !body.trim()}
          className="btn btn-primary h-11 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {isSupport && (
          <>
            <button
              type="button"
              onClick={() => changeStatus("Resolved")}
              className="btn btn-ghost h-9 border border-line text-sm"
            >
              {t.supMarkResolved}
            </button>
            <button
              type="button"
              onClick={() => changeStatus("Closed")}
              className="btn btn-ghost h-9 border border-line text-sm"
            >
              {t.supClose}
            </button>
          </>
        )}
        {!isSupport && !closed && (
          <button
            type="button"
            onClick={() => changeStatus("Closed")}
            className="btn btn-ghost h-9 border border-line text-sm"
          >
            {t.supCloseMine}
          </button>
        )}
      </div>
    </div>
  );
}

/** Shared status chip so the buyer and operator lists read identically. */
export function StatusChip({ status }: { status: TicketStatus }) {
  const { t } = useI18n();
  const label: Record<TicketStatus, string> = {
    Open: t.supStatusOpen,
    "Awaiting customer": t.supStatusAwaitCustomer,
    "Awaiting support": t.supStatusAwaitSupport,
    Resolved: t.supStatusResolved,
    Closed: t.supStatusClosed,
  };
  const tone: Record<TicketStatus, string> = {
    Open: "bg-blue-50 text-blue-600",
    "Awaiting customer": "bg-[#fdf2dd] text-[#854f0b]",
    "Awaiting support": "bg-blue-50 text-blue-600",
    Resolved: "bg-emerald-50 text-emerald-700",
    Closed: "bg-ink-50 text-ink-500",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[status]}`}>
      {label[status]}
    </span>
  );
}

/** Category labels, shared by the buyer and operator screens. */
export function useCategoryLabels(): Record<string, string> {
  const { t } = useI18n();
  return {
    "Order issue": t.supCatOrder,
    Payment: t.supCatPayment,
    Delivery: t.supCatDelivery,
    Product: t.supCatProduct,
    Return: t.supCatReturn,
    Account: t.supCatAccount,
    Other: t.supCatOther,
  };
}
