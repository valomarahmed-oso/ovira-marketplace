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
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as OperatorOverview | null;
  } catch {
    return null;
  }
}
