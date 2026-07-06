"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  getAlertStatus,
  subscribeStockAlert,
  unsubscribeStockAlert,
} from "@/lib/stock-alerts-api";

/** Shown on a sold-out product: lets a signed-in shopper get an in-app alert
 *  when it's back in stock. Guests are pointed to sign in first. */
export function StockAlertButton({ slug }: { slug: string }) {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    getAlertStatus(slug).then((s) => {
      if (!cancelled) setSubscribed(s.subscribed);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, user, slug]);

  async function toggle() {
    setBusy(true);
    try {
      const next = subscribed
        ? await unsubscribeStockAlert(slug)
        : await subscribeStockAlert(slug);
      setSubscribed(next);
    } catch {
      /* keep current state on failure */
    } finally {
      setBusy(false);
    }
  }

  // Guests: invite them to sign in (the alert needs an account to reach them).
  if (ready && !user) {
    return (
      <Link
        href="/login"
        className="btn btn-ghost w-full justify-center"
      >
        <Bell className="h-5 w-5" /> سجّل الدخول ليصلك تنبيه عند التوفّر
      </Link>
    );
  }

  if (subscribed) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="btn btn-ghost group w-full justify-center text-mint disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Check className="h-5 w-5 group-hover:hidden" />
            <BellOff className="hidden h-5 w-5 group-hover:block" />
          </>
        )}
        <span className="group-hover:hidden">هنعلمك أول ما يتوفّر</span>
        <span className="hidden group-hover:inline">إلغاء التنبيه</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="btn btn-primary w-full justify-center disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
      أعلمني عند التوفّر
    </button>
  );
}
