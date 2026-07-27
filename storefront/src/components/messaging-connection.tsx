"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, QrCode, RefreshCw, XCircle, AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  getSenderStatus,
  getWahaQr,
  unlinkWaha,
  type SenderStatus,
} from "@/lib/messaging-hub";

/** Live connection state for one sender, plus the WhatsApp QR pairing flow.
 *
 *  The distinction that matters: `ok` means the credentials were accepted,
 *  `ready` means a message sent this second would actually leave. Self-hosted
 *  WhatsApp with no number linked is the first without the second — the state a
 *  plain "connected" badge hides, and the reason sends fail with no explanation.
 */
export function SenderConnection({
  sender,
  onChanged,
}: {
  sender: { name: string; channel: string };
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<SenderStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [linking, setLinking] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await getSenderStatus(sender.name));
    } catch {
      setStatus({ ok: false, ready: false, state: "error" });
    }
    setBusy(false);
  }, [sender.name]);

  useEffect(() => {
    void check();
  }, [check]);

  const unlink = async () => {
    if (!window.confirm(t.mhUnlinkConfirm)) return;
    try {
      await unlinkWaha(sender.name);
    } catch {
      /* the status refresh below tells the real story */
    }
    void check();
    onChanged?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {busy ? (
          <Badge tone="muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.mhStatusChecking}
          </Badge>
        ) : status?.ready ? (
          <Badge tone="ok">
            <CheckCircle2 className="h-3.5 w-3.5" /> {t.mhStatusReady}
          </Badge>
        ) : status?.ok ? (
          <Badge tone="warn">
            <AlertTriangle className="h-3.5 w-3.5" /> {t.mhStatusNotLinked}
          </Badge>
        ) : (
          <Badge tone="bad">
            <XCircle className="h-3.5 w-3.5" /> {t.mhStatusBroken}
          </Badge>
        )}

        <button
          type="button"
          onClick={() => void check()}
          className="rounded-lg p-1 text-ink-400 hover:bg-line/40"
          aria-label={t.mhRefresh}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {status?.can_link && !status.ready && (
          <button
            type="button"
            onClick={() => setLinking(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            <QrCode className="h-3.5 w-3.5" /> {t.mhLinkNumber}
          </button>
        )}
        {status?.can_link && status.ready && (
          <button
            type="button"
            onClick={() => void unlink()}
            className="text-xs text-ink-400 underline underline-offset-2 hover:text-coral"
          >
            {t.mhUnlink}
          </button>
        )}
      </div>

      {status?.detail && <p className="text-xs text-ink-400">{status.detail}</p>}

      {linking && (
        <LinkDialog
          senderName={sender.name}
          onDone={() => {
            setLinking(false);
            void check();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  children: React.ReactNode;
}) {
  const cls = {
    ok: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    bad: "bg-coral-50 text-coral",
    muted: "bg-line/40 text-ink-400",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

/** The QR pairing modal. Fetching the code repairs a fallen-over session first,
 *  which can take up to a minute — so the wait is explained rather than silent. */
function LinkDialog({
  senderName,
  onDone,
}: {
  senderName: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setQr(null);
    try {
      const res = await getWahaQr(senderName);
      setDetail(res.status?.detail ?? null);
      if (res.status?.ready) setConnected(true);
      else setQr(res.qr);
    } catch (e) {
      setDetail(e instanceof Error ? e.message : t.mhLinkNoCode);
    }
    setLoading(false);
  }, [senderName, t.mhLinkNoCode]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the code is on screen: the moment the phone finishes pairing the
  // dialog should say so, not sit there showing a code that already worked.
  useEffect(() => {
    if (connected || loading) return;
    const id = setInterval(async () => {
      try {
        const st = await getSenderStatus(senderName);
        if (st.ready) {
          setConnected(true);
          setDetail(st.detail ?? null);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [connected, loading, senderName]);

  useEffect(() => {
    if (!connected) return;
    const id = setTimeout(onDone, 1800);
    return () => clearTimeout(id);
  }, [connected, onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onDone}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-medium text-ink">{t.mhLinkTitle}</h3>

        {loading ? (
          <div className="space-y-3 py-6">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
            <p className="text-xs leading-relaxed text-ink-400">{t.mhLinkPreparing}</p>
          </div>
        ) : connected ? (
          <div className="space-y-2 py-6">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
            <p className="font-medium text-ink">{t.mhLinkConnected}</p>
            {detail && <p className="text-xs text-ink-400">{detail}</p>}
          </div>
        ) : qr ? (
          <>
            <p className="text-start text-xs leading-relaxed text-ink-400">{t.mhLinkSteps}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR"
              className="mx-auto h-60 w-60 rounded-xl bg-white p-2"
            />
            <p className="text-xs text-ink-400">{t.mhLinkWaiting}</p>
          </>
        ) : (
          <p className="py-4 text-sm text-coral">{detail ?? t.mhLinkNoCode}</p>
        )}

        <div className="flex justify-center gap-2">
          {!connected && (
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-line px-3 py-2 text-sm text-ink hover:bg-line/30"
            >
              {t.mhLinkNewCode}
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl px-3 py-2 text-sm text-ink-400 hover:bg-line/30"
          >
            {t.mhCancel}
          </button>
        </div>
      </div>
    </div>
  );
}
