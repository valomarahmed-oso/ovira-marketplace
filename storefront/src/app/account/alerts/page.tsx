"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Loader2, PackageCheck, PackageX, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getMyAlerts, unsubscribeStockAlert, type StockAlert } from "@/lib/stock-alerts-api";
import { formatPrice } from "@/lib/utils";

const FRAPPE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const abs = (p?: string | null) =>
  !p ? undefined : /^https?:\/\//.test(p) ? p : `${FRAPPE}${p.startsWith("/") ? "" : "/"}${p}`;

export default function AlertsPage() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAlerts(await getMyAlerts());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(a: StockAlert) {
    setRemoving(a.slug);
    try {
      await unsubscribeStockAlert(a.slug);
      setAlerts((prev) => prev.filter((x) => x.alert !== a.alert));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.alertsTitle}</h2>
        <p className="text-sm text-ink-400">{t.alertsSubtitle}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <BellRing className="h-8 w-8" />
          <p>{t.alertsEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const img = abs(a.image);
            return (
              <div key={a.alert} className="card flex items-center gap-3 p-3">
                <Link
                  href={`/product/${a.slug}`}
                  className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-blue-50"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={a.title} className="h-full w-full object-cover" />
                  ) : (
                    <BellRing className="h-6 w-6 text-blue-600" />
                  )}
                </Link>
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/product/${a.slug}`}
                    className="line-clamp-1 text-sm font-medium text-ink transition-colors hover:text-blue-600"
                  >
                    {a.title}
                  </Link>
                  <div className="font-tech text-sm text-ink-600">{formatPrice(a.price, a.currency)}</div>
                  {a.available ? (
                    <span className="inline-flex items-center gap-1 text-xs text-mint">
                      <PackageCheck className="h-3.5 w-3.5" /> {t.alertsAvailable}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                      <PackageX className="h-3.5 w-3.5" /> {t.alertsUnavailable}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {a.available && (
                    <Link href={`/product/${a.slug}`} className="btn btn-primary h-9 px-3 text-sm">
                      {t.alertsBuyNow}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    disabled={removing === a.slug}
                    aria-label={t.alertsRemove}
                    className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral disabled:opacity-50"
                  >
                    {removing === a.slug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
