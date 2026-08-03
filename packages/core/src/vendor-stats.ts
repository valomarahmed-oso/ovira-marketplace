/** Where a seller's interest turns into sales, and where it stops. */

import { get } from "./http.js";

const NS = "ovira_marketplace.api.product_stats";
const VENDOR = "ovira_marketplace.api.vendor";

/**
 * What the server concluded about a product, in the seller's language.
 *
 * Named rather than numeric because the number is not the point: "they look and
 * walk away" tells a seller to change the price or the photo, where a 0% cart
 * rate tells them nothing they can act on. The thresholds are deliberately
 * loose server-side — this points at where to look, it does not pretend a
 * handful of visits is a sound sample.
 */
export type FunnelDiagnosis =
  | "unpublished"
  | "no_data"
  | "unseen"
  | "not_tempting"
  | "abandoned"
  | "healthy";

/** One product's path from being seen to being bought. */
export type FunnelRow = {
  product: string;
  title: string;
  price: number;
  stock_qty: number;
  published: 0 | 1;
  views: number;
  cart_adds: number;
  sold: number;
  /** Percentages the server computes, so two clients cannot round differently. */
  view_to_cart: number;
  cart_to_sale: number;
  diagnosis: FunnelDiagnosis | string;
};

/**
 * Sorted by the **gap** between interest and sales, not by either number: a
 * product plenty look at and nobody buys is the one a seller can fix today.
 */
export async function myProductFunnel(
  days = 30,
  limit = 50,
): Promise<{ days: number; rows: FunnelRow[] }> {
  return (
    (await get<{ days: number; rows: FunnelRow[] }>(`${NS}.my_product_funnel`, { days, limit })) ?? {
      days,
      rows: [],
    }
  );
}

/** The seller's own orders as CSV text, for a spreadsheet or an accountant. */
export async function exportMyOrdersCsv(): Promise<{ csv: string; count: number }> {
  return (
    (await get<{ csv: string; count: number }>(`${VENDOR}.export_my_orders_csv`)) ?? {
      csv: "",
      count: 0,
    }
  );
}
