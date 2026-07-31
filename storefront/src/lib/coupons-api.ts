import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.coupons";

export type Coupon = {
  code: string;
  description?: string;
  vendor?: string | null;
  active: number;
  discount_type: "Percentage" | "Fixed";
  discount_value: number;
  max_discount?: number;
  min_subtotal?: number;
  expires_on?: string | null;
  usage_limit?: number;
  used_count?: number;
};

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
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ الكوبون."));
  return (await res.json()).message as T;
}

export async function listCoupons(): Promise<Coupon[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_coupons`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("coupons-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Coupon[];
  } catch {
    return [];
  }
}

export const upsertCoupon = (body: Record<string, unknown>) =>
  post<Coupon>("upsert_coupon", body);

export const deleteCoupon = (code: string) =>
  post<{ deleted: string }>("delete_coupon", { code });

// -- vendor self-service (each vendor funds their own coupons) ---------------

export async function myCoupons(): Promise<Coupon[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.my_coupons`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("coupons-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Coupon[];
  } catch {
    return [];
  }
}

export const upsertMyCoupon = (body: Record<string, unknown>) =>
  post<Coupon>("upsert_my_coupon", body);

export const deleteMyCoupon = (code: string) =>
  post<{ deleted: string }>("delete_my_coupon", { code });
