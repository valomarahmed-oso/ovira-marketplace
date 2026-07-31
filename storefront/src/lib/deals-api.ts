import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.deals";

export type Deal = {
  name: string;
  product: string;
  product_title?: string;
  product_slug?: string;
  product_price?: number;
  deal_price: number;
  starts_on?: string | null;
  ends_on: string;
  stock_limit?: number;
  sold?: number;
  active: number;
  is_live?: boolean;
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
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ العرض."));
  return (await res.json()).message as T;
}

export async function listAllDeals(): Promise<Deal[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_all_deals`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("deals-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Deal[];
  } catch {
    return [];
  }
}

export const upsertDeal = (body: Record<string, unknown>) => post<Deal>("upsert_deal", body);

export const deleteDeal = (name: string) => post<{ deleted: string }>("delete_deal", { name });
