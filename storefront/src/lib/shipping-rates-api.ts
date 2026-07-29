import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.shipping";

export type ShippingRate = {
  name?: string;
  governorate: string;
  fee: number;
  free_threshold?: number;
  eta_days?: number;
  enabled?: number;
};

/** Public: enabled per-governorate rates (fee + free threshold + ETA). */
export async function getShippingRates(): Promise<ShippingRate[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.shipping_rates`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as ShippingRate[];
  } catch {
    return [];
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
    if (raw) return JSON.parse(raw).message ?? fallback;
    if (data?.exception) return String(data.exception).replace(/^[^:]+:\s*/, "");
  } catch {
    /* ignore */
  }
  return fallback;
}

async function post<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ سعر الشحن."));
  return (await res.json()).message as T;
}

export async function listShippingRates(): Promise<ShippingRate[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_shipping_rates`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as ShippingRate[];
  } catch {
    return [];
  }
}

export const upsertShippingRate = (body: Record<string, unknown>) =>
  post<ShippingRate>("upsert_shipping_rate", body);

export const deleteShippingRate = (name: string) =>
  post<{ deleted: string }>("delete_shipping_rate", { name });

// -- delivery options the shopper picks between -----------------------------

export type ShippingMethod = {
  name: string;
  method_name: string;
  method_name_en?: string | null;
  surcharge: number;
  eta_min_days: number;
  eta_max_days: number;
  description?: string | null;
  is_default?: number;
  display_order?: number;
  enabled?: number;
};

/** Full quote: base fee, the picked method's extra, and the delivery window. */
export type ShippingQuote = {
  base: number;
  surcharge: number;
  total: number;
  method: string | null;
  method_name: string | null;
  method_name_en: string | null;
  eta_min_days: number;
  eta_max_days: number;
};

/** Public: the delivery options at checkout. Empty when none are configured —
 *  the picker hides and the store prices delivery as it always did. */
export async function getShippingMethods(): Promise<ShippingMethod[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_shipping_methods`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as ShippingMethod[];
  } catch {
    return [];
  }
}

export async function getShippingQuote(
  items: { slug: string; qty: number; variant?: string }[],
  governorate?: string,
  method?: string | null,
): Promise<ShippingQuote | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/${M}.quote`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ items, governorate, method }),
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as ShippingQuote | null;
  } catch {
    return null;
  }
}

export async function listShippingMethodsAdmin(): Promise<ShippingMethod[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_shipping_methods_admin`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as ShippingMethod[];
  } catch {
    return [];
  }
}

export const upsertShippingMethod = (body: Record<string, unknown>) =>
  post<ShippingMethod>("upsert_shipping_method", body);

export const deleteShippingMethod = (name: string) =>
  post<{ deleted: string }>("delete_shipping_method", { name });
