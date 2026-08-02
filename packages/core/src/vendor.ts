/**
 * The seller's side of the marketplace.
 *
 * Every read here is already scoped to the signed-in vendor by the server —
 * `my_orders` returns each order's **vendor slice** (their line count and their
 * subtotal), never the marketplace total. That distinction is the whole reason
 * these are separate endpoints from the buyer's: a seller who sees the full
 * order value of a basket containing three other shops' goods will believe they
 * are owed it.
 */

import { get, post } from "./http.js";

const VENDOR = "ovira_marketplace.api.vendor";
const SHIPPING = "ovira_marketplace.api.shipping";

export type VendorStore = {
  name: string;
  vendor_name: string;
  slug?: string;
  status?: string;
  email?: string | null;
  phone?: string | null;
  logo?: string | null;
  banner?: string | null;
  description?: string | null;
  return_policy?: string | null;
  shipping_policy?: string | null;
  /** Per-Vendor shipping mode only; ignored when the operator sets the rates. */
  shipping_type?: "Flat" | "Free Over" | "Always Free" | null;
  shipping_fee?: number;
  shipping_free_over?: number;
  commission_rate?: number;
  trust_score?: number | null;
  trust_tier?: string | null;
};

/** Exactly what `VENDOR_EDITABLE_FIELDS` accepts — anything else is ignored. */
export type VendorStoreInput = {
  vendor_name?: string;
  description?: string | null;
  phone?: string | null;
  return_policy?: string | null;
  shipping_policy?: string | null;
  shipping_type?: "Flat" | "Free Over" | "Always Free";
  shipping_fee?: number;
  shipping_free_over?: number;
  logo?: string | null;
  banner?: string | null;
};

/** Edit the store profile. Scoped server-side to the caller's own vendor. */
export function updateMyStore(input: VendorStoreInput): Promise<VendorStore> {
  return post(`${VENDOR}.update_my_store`, input, "تعذّر حفظ بيانات المتجر.");
}

/** One order, reduced to this vendor's share of it. */
export type VendorOrder = {
  name: string;
  customer_name?: string | null;
  status: string;
  currency?: string;
  creation: string;
  item_count: number;
  vendor_total: number;
};

export type VendorTotals = {
  gross_sales: number;
  commission: number;
  net_earnings: number;
  units_sold: number;
  orders: number;
  avg_order_value: number;
};

export type VendorAnalytics = {
  currency: string;
  products: number;
  totals: VendorTotals;
  period_days: number;
  period: { revenue: number; units: number; orders: number };
  trend: Array<{ date: string; revenue: number }>;
  top_products: Array<{ product: string; title: string; qty: number; revenue: number }>;
  status_breakdown: Array<{ status: string; count: number }>;
};

export async function myStore(): Promise<VendorStore | null> {
  return get<VendorStore>(`${VENDOR}.my_store`);
}

export async function vendorOrders(limit = 100): Promise<VendorOrder[]> {
  return (await get<VendorOrder[]>(`${VENDOR}.my_orders`, { limit })) ?? [];
}

export async function vendorAnalytics(days = 30): Promise<VendorAnalytics | null> {
  return get<VendorAnalytics>(`${VENDOR}.vendor_analytics`, { days });
}

/**
 * Fulfilment state per order, so a list can show what still needs packing.
 *
 * Returned as a map rather than joined onto the orders because a vendor may
 * have no shipment for an order at all — which is precisely the state that
 * matters, and a join would render it as an absence rather than a to-do.
 */
export async function vendorShipmentStatuses(): Promise<Record<string, string>> {
  return (await get<Record<string, string>>(`${SHIPPING}.vendor_shipment_statuses`)) ?? {};
}

/**
 * Book the shipment for this vendor's slice of an order.
 *
 * Idempotent per Sales Order on the server. The courier is what the vendor
 * actually used — if they don't name one, the server falls back to the courier
 * the *buyer* asked for, because asking and then ignoring the answer is worse
 * than never asking.
 */
export async function shipVendorOrder(input: {
  order: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}): Promise<{ name: string; status: string }> {
  return post(
    `${SHIPPING}.create_my_shipment`,
    {
      order: input.order,
      carrier: input.carrier,
      tracking_number: input.trackingNumber,
      tracking_url: input.trackingUrl,
    },
    "تعذّر تسجيل الشحنة.",
  );
}
