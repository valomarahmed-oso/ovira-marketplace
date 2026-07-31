"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Registers the service worker — and tells the shopper when a newer version of
 * the store is sitting behind it.
 *
 * Without the prompt, an installed PWA keeps running the version it was opened
 * with until every last tab is closed, which on a phone can be weeks. This store
 * ships fixes to prices, stock and checkout; someone still running last month's
 * JavaScript is exactly the person each of those fixes was written for.
 */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Register only in production — a dev service worker caches stale assets
    // and interferes with hot reload.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    // updateViaCache:"none" + an explicit update() force the browser to fetch
    // a fresh sw.js on every load, so a fixed SW rolls out immediately.
    navigator.serviceWorker
      .register("/shop/sw.js", { scope: "/shop/", updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return;
        void reg.update();

        // Already waiting when the page loaded — a previous visit fetched it.
        if (reg.waiting) setWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            // `controller` is null on the very first install. That one is not
            // an update, and telling a first-time visitor there is a "new
            // version" of a store they have never seen is nonsense.
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(next);
            }
          });
        });
      })
      .catch(() => {});

    // Once the new worker takes control, this page is old code running against
    // a new cache — so reload exactly once. The guard matters: without it a
    // second controllerchange puts the tab in a reload loop.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="card flex items-center gap-3 px-4 py-3 shadow-lg">
        <RefreshCw className="h-4 w-4 shrink-0 text-blue-600" />
        <span className="text-sm text-ink">في نسخة جديدة من المتجر</span>
        <button
          type="button"
          onClick={() => waiting.postMessage("ovira:skip-waiting")}
          className="btn btn-primary px-4 py-1.5 text-sm"
        >
          حدّث
        </button>
      </div>
    </div>
  );
}
