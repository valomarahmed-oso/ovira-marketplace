import { reportApiFailure } from "@/lib/api-errors";
const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type FullReport = {
  from_date: string;
  to_date: string;
  generated_on: string;
  currency: string;
  summary: {
    orders: number;
    paid_orders: number;
    revenue: number;
    aov: number;
    discounts: number;
    shipping: number;
  };
  by_status: { status: string; cnt: number }[];
  top_products: { title: string; qty: number; revenue: number }[];
  vendor_sales: { vendor: string | null; orders: number; gross: number; commission: number; net: number }[];
  inventory: {
    total: number;
    out_of_stock: number;
    low_stock: { title: string; stock_qty: number; low_stock_threshold: number }[];
  };
  coupons: { code: string; discount_type: string; discount_value: number; used_count: number; vendor: string | null }[];
};

async function fetchReport<T>(method: string, fromDate: string, toDate: string): Promise<T | null> {
  if (!BASE) return null;
  try {
    const qs = new URLSearchParams({ from_date: fromDate, to_date: toDate }).toString();
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.reports.${method}?${qs}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("reports-api", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as T | null;
  } catch (err) {
    reportApiFailure("reports-api", err);
    return null;
  }
}

export const getFullReport = (from: string, to: string) =>
  fetchReport<FullReport>("full_report", from, to);

export type VendorReport = {
  from_date: string;
  to_date: string;
  generated_on: string;
  currency: string;
  summary: { orders: number; units: number; gross: number; commission: number; net: number; aov: number };
  by_status: { status: string; cnt: number }[];
  top_products: { title: string; qty: number; revenue: number }[];
  low_stock: { title: string; stock_qty: number; low_stock_threshold: number }[];
};

export const getVendorReport = (from: string, to: string) =>
  fetchReport<VendorReport>("vendor_report", from, to);

export type BuyerReport = {
  from_date: string;
  to_date: string;
  generated_on: string;
  currency: string;
  summary: { orders: number; paid_orders: number; spent: number; aov: number };
  by_status: { status: string; cnt: number }[];
  top_products: { title: string; qty: number; spent: number }[];
};

export const getBuyerReport = (from: string, to: string) =>
  fetchReport<BuyerReport>("buyer_report", from, to);
