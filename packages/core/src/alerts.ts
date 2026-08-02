/** Back-in-stock alerts — "tell me when this is available again". */

import { fileUrl } from "./config.js";
import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.stock_alerts";

export type AlertStatus = { authenticated: boolean; subscribed: boolean };

export type StockAlert = {
  alert: string;
  product: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  image?: string | null;
  /** Back on the shelf as of this read. */
  available: boolean;
  /** 1 once the shopper has been told; the row stays as a record. */
  notified: number;
};

export async function myAlerts(): Promise<StockAlert[]> {
  const rows = (await get<StockAlert[]>(`${NS}.my_alerts`)) ?? [];
  return rows.map((a) => ({ ...a, image: fileUrl(a.image) ?? null }));
}

/**
 * Whether this shopper is already waiting on this product.
 *
 * Returns `authenticated: false` rather than throwing for a guest, because the
 * product page asks this on every load and a signed-out visitor is the normal
 * case, not an error.
 */
export async function alertStatus(slug: string): Promise<AlertStatus> {
  return (
    (await get<AlertStatus>(`${NS}.alert_status`, { slug })) ?? {
      authenticated: false,
      subscribed: false,
    }
  );
}

async function toggle(method: string, slug: string): Promise<boolean> {
  const res = await post<{ subscribed?: boolean }>(`${NS}.${method}`, { slug });
  return !!res?.subscribed;
}

export const subscribeStockAlert = (slug: string) => toggle("subscribe", slug);
export const unsubscribeStockAlert = (slug: string) => toggle("unsubscribe", slug);
