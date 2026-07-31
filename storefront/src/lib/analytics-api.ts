import { reportApiFailure } from "@/lib/api-errors";
const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.analytics";

export type TrendPoint = { date: string; gmv: number };
export type TopProduct = { product: string; title: string; qty: number; revenue: number };
export type TopVendor = { vendor: string; vendor_name: string; gmv: number; commission: number };
export type StatusRow = { status: string; count: number };

export type OperatorOverview = {
  currency: string;
  period_days: number;
  totals: {
    gmv: number;
    orders: number;
    completed: number;
    commission: number;
    aov: number;
  };
  trend: TrendPoint[];
  top_products: TopProduct[];
  top_vendors: TopVendor[];
  status_breakdown: StatusRow[];
  ad_revenue: number;
  wallet_liability: number;
  loyalty_outstanding: number;
};

export async function getOperatorOverview(days = 30): Promise<OperatorOverview | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/${M}.operator_overview?days=${days}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("analytics-api", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as OperatorOverview | null;
  } catch (err) {
    reportApiFailure("analytics-api", err);
    return null;
  }
}

async function fetchCsv(method: string, params: Record<string, string | number>): Promise<string> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`${BASE}/api/method/${M}.${method}?${qs}`, {
    headers: { Accept: "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("تعذّر تصدير الملف.");
  return String((await res.json()).message ?? "");
}

/** Operator-only CSV of every order in the window (days=0 => all time). */
export const exportOrdersCsv = (days = 30, status?: string) =>
  fetchCsv("export_orders_csv", status ? { days, status } : { days });

/** Operator-only CSV of units + revenue + commission per product in the window. */
export const exportProductsCsv = (days = 30) => fetchCsv("export_products_csv", { days });

/** Trigger a browser download of CSV text as a named file. */
export function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
