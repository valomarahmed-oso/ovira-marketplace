"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

/** The non-standard event Chromium fires when the app is installable. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ovira-install-dismissed";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000; // don't nag for two weeks

function dismissedRecently() {
  try {
    const ts = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

/** Already running as an installed app — nothing to prompt. */
function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari never fires beforeinstallprompt, so we detect it to show a manual hint. */
function isIosSafari() {
  const ua = window.navigator.userAgent;
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
  const webkit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return ios && webkit;
}

/** Dismissible "Add to Home Screen" banner. Uses the native install flow on
 *  Chromium and a manual instruction on iOS Safari; hides once installed. */
export function InstallPrompt() {
  const { t } = useI18n();
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"native" | "ios" | null>(null);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setMode("native");
    };
    const onInstalled = () => {
      deferred.current = null;
      setMode(null);
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS gets a manual hint after a short beat (only if nothing else showed).
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIosSafari()) {
      timer = setTimeout(() => setMode((m) => m ?? "ios"), 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setMode(null);
  }

  async function install() {
    const evt = deferred.current;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice.catch(() => {});
    deferred.current = null;
    setMode(null);
  }

  if (!mode) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-lg">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50">
          <Download className="h-5 w-5 text-blue-600" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">{t.installTitle}</div>
          <div className="text-xs leading-snug text-ink-400">
            {mode === "ios" ? t.installIosHint : t.installSubtitle}
          </div>
        </div>
        {mode === "native" && (
          <button
            type="button"
            onClick={install}
            className="btn btn-primary h-9 shrink-0 px-3 text-sm"
          >
            {t.installAction}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.installDismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-blue-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
