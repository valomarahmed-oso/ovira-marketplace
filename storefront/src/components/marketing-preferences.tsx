"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, BellRing } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  myNotificationPreferences,
  setMyNotificationPreferences,
} from "@/lib/notifications-admin";

/** What marketing this customer wants.
 *
 *  Order, shipping, refund and delivery-code messages are deliberately absent:
 *  they're part of the purchase, not a subscription, so offering a switch for
 *  them would promise something the store can't honour.
 */
export function MarketingPreferences() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<{ marketing_email: boolean; marketing_push: boolean } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => setPrefs(await myNotificationPreferences()))();
  }, []);

  const update = async (next: { marketing_email: boolean; marketing_push: boolean }) => {
    setPrefs(next);
    setBusy(true);
    try {
      await setMyNotificationPreferences({
        marketing_email: next.marketing_email ? 1 : 0,
        marketing_push: next.marketing_push ? 1 : 0,
      });
    } catch {
      /* the next load reflects the truth */
    }
    setBusy(false);
  };

  if (!prefs) {
    return (
      <div className="card flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-5">
      <div>
        <h3 className="font-medium text-ink">{t.nfPrefsTitle}</h3>
        <p className="text-xs text-ink-400">{t.nfPrefsHint}</p>
      </div>

      <Toggle
        icon={Mail}
        label={t.nfPrefEmail}
        checked={prefs.marketing_email}
        disabled={busy}
        onChange={(v) => void update({ ...prefs, marketing_email: v })}
      />
      <Toggle
        icon={BellRing}
        label={t.nfPrefPush}
        checked={prefs.marketing_push}
        disabled={busy}
        onChange={(v) => void update({ ...prefs, marketing_push: v })}
      />
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Mail;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
      <input
        type="checkbox"
        className="h-4 w-4 accent-blue-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <Icon className="h-4 w-4 text-ink-400" />
      {label}
    </label>
  );
}
