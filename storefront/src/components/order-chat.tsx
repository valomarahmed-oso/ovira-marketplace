"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getThread, postMessage, type ChatMessage } from "@/lib/messaging-api";

/** An order-scoped buyer↔vendor conversation. Works from either side — the
 *  backend derives the caller's role from the session; the caller only names the
 *  order + vendor. */
export function OrderChat({ order, vendor }: { order: string; vendor: string }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getThread(order, vendor)
      .then((res) => {
        if (!alive) return;
        setMessages(res?.messages ?? []);
        // The operator can read any thread for moderation but can't post in it.
        setReadOnly(res?.role === "operator");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [order, vendor]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await postMessage(order, vendor, body);
      setMessages((m) => [...m, msg]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.chatSendErr);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-80 min-h-24 space-y-2 overflow-y-auto rounded-xl bg-[#faf9f5] p-3">
        {loading ? (
          <div className="flex h-24 items-center justify-center text-ink-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1 text-center text-sm text-ink-400">
            <MessageCircle className="h-6 w-6" />
            {t.chatEmpty}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.mine ? "items-start" : "items-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.mine ? "bg-blue text-white" : "border border-line bg-white text-[#20242c]"
                }`}
              >
                {!m.mine && m.sender_name && (
                  <div className="mb-0.5 text-[11px] font-medium text-ink-400">{m.sender_name}</div>
                )}
                <div className="whitespace-pre-wrap break-words leading-6">{m.body}</div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="mt-2 text-xs text-coral">{error}</div>}

      {readOnly ? (
        <div className="mt-3 rounded-xl bg-[#f1efe8] px-4 py-2.5 text-center text-xs text-ink-400">
          {t.chatModerationView}
        </div>
      ) : (
        <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          rows={1}
          placeholder={t.chatPlaceholder}
          className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-blue"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="btn btn-primary h-11 px-4 disabled:opacity-50"
          aria-label={t.chatSend}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
        </form>
      )}
    </div>
  );
}
