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
