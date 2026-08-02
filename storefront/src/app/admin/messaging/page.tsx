"use client";

// The messaging gateway in the marketplace admin.
//
// This page used to be five hundred lines of bespoke screen: its own sender
// cards, its own delivery log, its own test send — a second implementation of
// what the gateway already had, kept in step by hand and quietly drifting out of
// it. Every channel added on one side had to be added again here, and the last
// two never were.
//
// `ovira_messaging` ships that console as a mountable widget now, so this is a
// container and a gate. The same code runs here, in the ERP portal and in the
// radiology portal, and it gains a channel in all three at once.
//
// `@/lib/messaging-hub` is deliberately left in place: other parts of the admin
// read from it, and the point of this change is one UI, not a deletion spree.

import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { MessagingGateway } from "@/components/messaging-gateway";

export default function AdminMessagingPage() {
  const { t, locale } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // The gateway re-checks this on every call it makes. Refusing here as well is
  // so the answer is a sentence rather than a screen of failed requests.
  if (!isOperator) {
    return (
      <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
        {t.msgGwOperatorOnly}
      </div>
    );
  }

  return (
    <div className="flex min-h-[75vh] flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">{t.msgGwTitle}</h1>
        <p className="mt-0.5 text-xs text-muted">{t.msgGwSub}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white">
        <MessagingGateway lang={locale === "en" ? "en" : "ar"} />
      </div>
    </div>
  );
}
