/** Date-ranged summaries. The buyer's own, and the seller's own. */

import { get } from "./http.js";

const NS = "ovira_marketplace.api.reports";

export type StatusCount = { status: string; cnt: number };

export type BuyerReport = {
  from_date: string;
  to_date: string;
  generated_on: string;
  currency: string;
  summary: { orders: number; paid_orders: number; spent: number; aov: number };
  by_status: StatusCount[];
  top_products: Array<{ title: string; qty: number; spent: number }>;
};

export type VendorReport = {
  from_date: string;
  to_date: string;
  generated_on: string;
  currency: string;
  summary: {
    orders: number;
    units: number;
    gross: number;
    commission: number;
    net: number;
    aov: number;
  };
  by_status: StatusCount[];
  top_products: Array<{ title: string; qty: number; revenue: number }>;
  low_stock: Array<{ title: string; stock_qty: number; low_stock_threshold: number }>;
};

export async function buyerReport(from: string, to: string): Promise<BuyerReport | null> {
  return get<BuyerReport>(`${NS}.buyer_report`, { from_date: from, to_date: to });
}

export async function vendorReport(from: string, to: string): Promise<VendorReport | null> {
  return get<VendorReport>(`${NS}.vendor_report`, { from_date: from, to_date: to });
}

/**
 * `YYYY-MM-DD` for a day `daysAgo` before today, which is the only date format
 * the report endpoints accept. Built from local parts rather than
 * `toISOString()`, which converts to UTC first and hands back yesterday for
 * anyone east of Greenwich — Cairo included, for most of the day.
 */
export function reportDate(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
