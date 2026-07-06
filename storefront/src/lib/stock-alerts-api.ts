import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.stock_alerts";

export type AlertStatus = { authenticated: boolean; subscribed: boolean };

export type StockAlert = {
  alert: string;
  product: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  image?: string | null;
  available: boolean;
  notified: number;
};

/** The signed-in shopper's back-in-stock subscriptions with product info. */
export async function getMyAlerts(): Promise<StockAlert[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.my_alerts`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const items = (await res.json())?.message;
    return Array.isArray(items) ? (items as StockAlert[]) : [];
  } catch {
    return [];
  }
}

/** Whether the signed-in shopper has a pending back-in-stock alert. */
export async function getAlertStatus(slug: string): Promise<AlertStatus> {
  if (!BASE) return { authenticated: false, subscribed: false };
  try {
    const res = await fetch(`${BASE}/api/method/${M}.alert_status?slug=${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return { authenticated: false, subscribed: false };
    return ((await res.json()).message ?? { authenticated: false, subscribed: false }) as AlertStatus;
  } catch {
    return { authenticated: false, subscribed: false };
  }
}

async function post(method: string, slug: string): Promise<boolean> {
  if (!BASE) return false;
  const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ slug }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("تعذّر تحديث التنبيه.");
  return !!(await res.json()).message?.subscribed;
}

export const subscribeStockAlert = (slug: string) => post("subscribe", slug);
export const unsubscribeStockAlert = (slug: string) => post("unsubscribe", slug);
