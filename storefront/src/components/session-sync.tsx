"use client";

import { useEffect } from "react";
import { fetchMe } from "@/lib/auth";
import { useAuth } from "@/lib/auth-store";

/**
 * Reconciles the persisted auth store with the real Frappe session on every
 * load. The localStorage copy is only an optimistic cache — the server session
 * (cookie) is the source of truth, so route guards can be trusted.
 */
export function SessionSync() {
  const setUser = useAuth((s) => s.setUser);
  const setReady = useAuth((s) => s.setReady);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (cancelled) return;
        setUser(user);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setUser, setReady]);

  return null;
}
