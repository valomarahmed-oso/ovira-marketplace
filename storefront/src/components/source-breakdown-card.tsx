"use client";

import { useEffect, useState } from "react";
import { PieChart } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getSourceBreakdown, type SourceBreakdown } from "@/lib/operator";

const LABELS: Record<string, { ar: string; en: string }> = {
  direct: { ar: "مباشر", en: "Direct" },
  organic: { ar: "بحث عضوي", en: "Organic search" },
  paid: { ar: "إعلانات مدفوعة", en: "Paid ads" },
  social: { ar: "سوشيال ميديا", en: "Social" },
  email: { ar: "بريد إلكتروني", en: "Email" },
  referral: { ar: "إحالة", en: "Referral" },
  other: { ar: "أخرى", en: "Other" },
};

const BAR: Record<string, string> = {
  direct: "bg-ink-300",
  organic: "bg-emerald-500",
  paid: "bg-brand",
  social: "bg-violet-500",
  email: "bg-amber-500",
  referral: "bg-sky-500",
  other: "bg-ink-200",
};

/** Operator card: where the last 30 days of orders came from. Hides itself when
 *  there's no data or the caller isn't an operator. */
export function SourceBreakdownCard() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [data, setData] = useState<SourceBreakdown | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSourceBreakdown(30).then((d) => {
      if (cancelled) return;
      setData(d);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !data || data.total_orders === 0) return null;

  const max = Math.max(...data.breakdown.map((r) => r.orders), 1);
  const num = (n: number) => Math.round(n).toLocaleString(ar ? "ar-EG" : "en-US");

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <PieChart className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold text-ink-700">
          {ar ? "مصادر الطلبات · آخر 30 يوم" : "Order sources · last 30 days"}
        </h2>
        <span className="ms-auto text-xs text-ink-400">
          {num(data.total_orders)} {ar ? "طلب" : "orders"}
        </span>
      </div>

      <div className="space-y-2">
        {data.breakdown.map((row) => {
          const label = LABELS[row.source] ?? { ar: row.source, en: row.source };
          const pct = Math.round((row.orders / data.total_orders) * 100);
          return (
            <div key={row.source} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-ink-600">{ar ? label.ar : label.en}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                <div
                  className={`h-full rounded-full ${BAR[row.source] ?? "bg-ink-200"}`}
                  style={{ width: `${Math.max((row.orders / max) * 100, 4)}%` }}
                />
              </div>
              <div className="w-10 shrink-0 text-end text-xs tabular-nums text-ink-500">{pct}%</div>
              <div className="w-24 shrink-0 text-end text-sm tabular-nums text-ink-700">
                {num(row.paid_revenue)}
                <span className="ms-1 text-xs text-ink-400">{ar ? "ج.م" : "EGP"}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-400">
        {ar ? "القيمة = إيراد الطلبات المدفوعة لكل مصدر" : "Value = paid-order revenue per source"}
      </p>
    </div>
  );
}
