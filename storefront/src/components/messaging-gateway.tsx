"use client";

// The messaging gateway, inside the marketplace admin.
//
// Not a reimplementation. `ovira_messaging` ships its console as a mountable
// widget, and this is a React wrapper around `OviraMessaging.mount()` — the same
// code the gateway serves at its own address and the same code the ERP portal
// and the radiology portal mount. Writing this screen a third time in React is
// how three copies become three products that disagree about what a channel is.
//
// The marketplace is the awkward host and the reason `mount` takes a `call` at
// all: the storefront is a Next.js app on ANOTHER ORIGIN from the bench, so the
// widget's default transport — same-origin fetch with a session cookie — cannot
// work here. It gets this app's own client instead, which is already configured
// with the bench URL, the CSRF token and credentialed requests.

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { writeHeaders } from "@/lib/frappe-client";

declare global {
  interface Window {
    OviraMessaging?: {
      mount: (
        target: string | HTMLElement,
        options: Record<string, unknown>,
      ) => { destroy: () => void };
    };
    __oviraMessagingLoading?: Promise<void>;
  }
}

const BENCH = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const ASSETS = `${BENCH}/assets/ovira_messaging`;

/** Fetch the widget once per page, from the bench that owns it.
 *
 *  Loaded from the bench rather than copied into this app's `public/` so there
 *  is exactly one build of it: a copy here would be a second version, stale from
 *  the first deploy that did not remember to update it. */
function loadWidget(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.OviraMessaging) return Promise.resolve();
  if (window.__oviraMessagingLoading) return window.__oviraMessagingLoading;

  window.__oviraMessagingLoading = new Promise<void>((resolve, reject) => {
    if (!document.querySelector("link[data-ovira-messaging]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${ASSETS}/css/ovira_messaging.css`;
      css.setAttribute("data-ovira-messaging", "1");
      document.head.appendChild(css);
    }
    const js = document.createElement("script");
    js.src = `${ASSETS}/js/ovira_messaging.js`;
    js.onload = () =>
      window.OviraMessaging
        ? resolve()
        : reject(new Error("ovira_messaging.js loaded but defined nothing"));
    js.onerror = () => reject(new Error(`could not fetch ${js.src}`));
    document.head.appendChild(js);
  });
  return window.__oviraMessagingLoading;
}

/** The transport the widget uses here.
 *
 *  Every screen in the widget goes through this and none of them know it exists,
 *  which is the point: the same Inbox that talks to a bench over a session
 *  cookie in the ERP portal talks to it over a credentialed cross-origin POST
 *  here, and neither had to be written twice. */
async function call(method: string, args: Record<string, unknown>) {
  const res = await fetch(`${BENCH}/api/method/${method}`, {
    method: "POST",
    credentials: "include",
    headers: writeHeaders(),
    body: JSON.stringify(args ?? {}),
  });
  const text = await res.text();
  let data: { message?: unknown; _server_messages?: string; exception?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* a Frappe error page, handled below */
  }
  if (!res.ok) {
    // Frappe puts the readable sentence in `_server_messages` as JSON inside
    // JSON. Unwrapped here so the widget shows what went wrong rather than
    // "500".
    let detail = "";
    try {
      const msgs = JSON.parse(data._server_messages ?? "[]") as string[];
      detail = msgs
        .map((m) => {
          try {
            return (JSON.parse(m) as { message?: string }).message ?? m;
          } catch {
            return m;
          }
        })
        .join("\n");
    } catch {
      /* nothing readable in there */
    }
    throw new Error(
      detail ||
        data.exception ||
        `${res.status} ${res.statusText}`,
    );
  }
  return data.message;
}

export function MessagingGateway({ lang }: { lang?: "ar" | "en" }) {
  // `t` here is a DICT, not a function — the marketplace keeps its strings in
  // two key-parallel objects and looks them up. See CLAUDE.md.
  const { t, locale } = useI18n();
  const host = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let widget: { destroy: () => void } | null = null;
    let cancelled = false;

    loadWidget()
      .then(() => {
        if (cancelled || !host.current || !window.OviraMessaging) return;
        widget = window.OviraMessaging.mount(host.current, {
          call,
          // MEMORY routing. The Next.js router owns this application's URL, and
          // a widget writing location.hash would navigate the admin out from
          // under whoever is using it.
          routing: "memory",
          lang: lang ?? (locale === "en" ? "en" : "ar"),
          // The admin shell already has the operator, the sign-out and the
          // language switch. A second set inside the panel reads as two
          // applications stacked on each other.
          chrome: false,
          onSignedOut: () => setError(t.msgGwSignedOut),
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // The widget holds a ResizeObserver and an interval for the unread badge.
      // React will unmount the node either way; without this the timers outlive
      // it and the admin gets slower the longer it stays open.
      if (widget) {
        try {
          widget.destroy();
        } catch {
          /* already gone */
        }
      }
    };
  }, [lang, t]);

  return (
    <div className="flex h-full min-h-[70vh] flex-col">
      {error ? (
        <div className="rounded-xl border border-line bg-white p-8 text-center text-sm">
          <p className="font-medium">{t.msgGwFailed}</p>
          <p className="mt-2 text-muted">{error}</p>
        </div>
      ) : loading ? (
        <div className="p-12 text-center text-sm text-muted">{t.msgGwOpening}</div>
      ) : null}
      <div ref={host} className="min-h-0 flex-1" />
    </div>
  );
}
