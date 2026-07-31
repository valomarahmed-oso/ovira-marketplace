import type { Product } from "@/lib/api";
import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.sponsored";

export type SponsoredPlacement = {
  name: string;
  product: string;
  product_title?: string;
  product_slug?: string;
  target_category?: string | null;
  target_category_name?: string | null;
  priority?: number;
  starts_on?: string | null;
  ends_on: string;
  budget?: number;
  cpc?: number;
  clicks?: number;
  impressions?: number;
  spend?: number;
  ctr?: number;
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
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ الإعلان."));
  return (await res.json()).message as T;
}

/** Public sponsored strip for a listing (global, or scoped to a category slug). */
export async function getSponsoredProducts(category?: string, limit = 8): Promise<Product[]> {
  if (!BASE) return [];
  try {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (category) qs.set("category", category);
    const res = await fetch(`${BASE}/api/method/${M}.sponsored_products?${qs}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("sponsored-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Product[];
  } catch {
    return [];
  }
}

/** Fire-and-forget click beacon so a sponsored click is billed to the campaign.
 *  Never throws — a failed beacon must not block the shopper's navigation. */
export function recordSponsoredClick(placement: string): void {
  if (!BASE || !placement) return;
  try {
    void fetch(`${BASE}/api/method/${M}.record_sponsored_click`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ placement }),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function listAllSponsored(): Promise<SponsoredPlacement[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_all_sponsored`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("sponsored-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as SponsoredPlacement[];
  } catch {
    return [];
  }
}

export const upsertSponsored = (body: Record<string, unknown>) =>
  post<SponsoredPlacement>("upsert_sponsored", body);

export const deleteSponsored = (name: string) =>
  post<{ deleted: string }>("delete_sponsored", { name });
