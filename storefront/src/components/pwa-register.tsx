"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    // Register only in production — a dev service worker caches stale assets
    // and interferes with hot reload.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
