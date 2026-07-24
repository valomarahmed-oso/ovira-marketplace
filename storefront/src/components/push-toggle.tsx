"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  getVapidPublicKey,
  isSubscribed,
  pushSupported,
  subscribePush,
  unsubscribePush,
} from "@/lib/push";

/** A card that lets a signed-in shopper turn browser push on/off. Hidden when
 *  push isn't configured on the server or the browser can't do it. */
export function PushToggle() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    getVapidPublicKey().then((key) => {
      if (!key) return;
      setAvailable(true);
      isSubscribed().then(setOn);
    });
  }, []);

  if (!user || !available) return null;

  async function enable() {
    setBusy(true);
    setMsg(null);
    const res = await subscribePush();
    if (res.ok) setOn(true);
    else setMsg(res.reason === "denied" ? t.pushDenied : t.pushError);
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    await unsubscribePush();
    setOn(false);
    setBusy(false);
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
          {on ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div>
          <div className="text-sm font-medium text-ink">{t.pushTitle}</div>
          <div className="text-xs text-ink-400">{msg ?? (on ? t.pushOnHint : t.pushOffHint)}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy}
        className={on ? "btn btn-ghost disabled:opacity-50" : "btn btn-primary disabled:opacity-50"}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? t.pushDisable : t.pushEnable}
      </button>
    </div>
  );
}
