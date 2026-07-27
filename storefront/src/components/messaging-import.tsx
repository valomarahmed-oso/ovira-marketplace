"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Info, Loader2, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  detectServerSources,
  importServerSource,
  type ServerSource,
} from "@/lib/messaging-hub";

/** One-click import of the channels this server is already configured for.
 *
 *  An operator cannot read back a stored credential — so asking them to re-type
 *  an internal WAHA URL, an SMTP password or a Meta token is asking for a typo
 *  and a support ticket. The server copies its own settings across instead;
 *  nothing sensitive passes through the browser.
 */
export function MessagingImport({ onImported }: { onImported?: () => void }) {
  const { t } = useI18n();
  const [sources, setSources] = useState<ServerSource[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSources(await detectServerSources());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (kind: string) => {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      const res = await importServerSource(kind);
      setNote(res.warning ?? (res.existed ? t.mhImportRefreshed : t.mhImportDone));
      await load();
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.mhSaveFailed);
    }
    setBusy(null);
  };

  if (!sources) {
    return (
      <div className="card flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  const wahaImported = sources.some((s) => s.kind === "waha" && s.imported);

  return (
    <section className="space-y-3">
      <h3 className="font-medium text-ink">{t.mhImportTitle}</h3>

      <div className="flex items-start gap-2 rounded-xl bg-blue-50/60 px-4 py-3 text-xs leading-relaxed text-ink-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <span>{t.mhImportHint}</span>
      </div>

      {note && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{note}</p>
      )}
      {error && <p className="rounded-xl bg-coral-50 px-4 py-2 text-sm text-coral">{error}</p>}

      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.kind} className="card flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{s.label}</span>
                {s.imported && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    {t.mhImported}
                  </span>
                )}
              </div>
              <p className="mt-1 break-words text-xs text-ink-400">{s.detail}</p>
              {s.warning && <p className="mt-1 text-xs text-amber-600">{s.warning}</p>}
            </div>

            {s.available ? (
              <button
                type="button"
                disabled={busy === s.kind}
                onClick={() => void run(s.kind)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  s.imported
                    ? "border border-line text-ink hover:bg-line/30"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {busy === s.kind ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : s.imported ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {s.imported ? t.mhImportRefresh : t.mhImportAction}
              </button>
            ) : (
              <span className="shrink-0 pt-2 text-xs text-ink-400">{t.mhImportUnavailable}</span>
            )}
          </div>
        ))}
      </div>

      {wahaImported && <p className="text-xs text-ink-400">{t.mhImportAfterWaha}</p>}
    </section>
  );
}
