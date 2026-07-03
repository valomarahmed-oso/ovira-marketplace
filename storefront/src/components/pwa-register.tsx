"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    // Register only in production — a dev service worker caches stale assets
    // and interferes with hot reload.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      // updateViaCache:"none" + an explicit update() force the browser to fetch
      // a fresh sw.js on every load, so a fixed SW rolls out immediately.
      navigator.serviceWorker
        .register("/shop/sw.js", { scope: "/shop/", updateViaCache: "none" })
        .then((reg) => reg.update())
        .catch(() => {});
    }
  }, []);
  return null;
}
