"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { unsubscribeByToken } from "@/lib/notifications-admin";

/** The landing page for the unsubscribe link in a marketing email.
 *
 *  It works without a login on purpose: a link that demands a sign-in isn't an
 *  unsubscribe link. The token in the URL proves the click came from a message
 *  we actually sent, so nobody can unsubscribe a stranger.
 */
export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <Unsubscribe />
    </Suspense>
  );
}

function Unsubscribe() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    if (!token) {
      setState("failed");
      return;
    }
    void (async () => {
      try {
        const res = await unsubscribeByToken(token);
        setState(res?.ok ? "done" : "failed");
      } catch {
        setState("failed");
      }
    })();
  }, [token]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="mb-6 text-xl font-medium text-ink">{t.nfUnsubTitle}</h1>

      {state === "working" && <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />}

      {state === "done" && (
        <div className="space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="text-ink">{t.nfUnsubDone}</p>
          <p className="text-xs text-ink-400">{t.nfPrefsHint}</p>
        </div>
      )}

      {state === "failed" && (
        <div className="space-y-3">
          <XCircle className="mx-auto h-10 w-10 text-coral" />
          <p className="text-ink">{t.nfUnsubFailed}</p>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block text-sm text-blue-600 underline">
        {t.nfUnsubTitle === "Unsubscribe" ? "Back to the store" : "الرجوع للمتجر"}
      </Link>
    </div>
  );
}
