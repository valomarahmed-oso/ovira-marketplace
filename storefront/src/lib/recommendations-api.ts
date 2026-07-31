import type { Product } from "@/lib/api";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.recommendations";

async function get(method: string, limit: number): Promise<Product[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.${method}?limit=${limit}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("recommendations-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Product[];
  } catch {
    return [];
  }
}

/** Personalised picks for the signed-in shopper (falls back to popular). */
export const getRecommendedForYou = (limit = 12) => get("recommended_for_you", limit);

/** Best-selling products (public). */
export const getPopularProducts = (limit = 12) => get("popular_products", limit);
