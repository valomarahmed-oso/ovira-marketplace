import { writeHeaders } from "@/lib/frappe-client";
import type { Product } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.wishlist";

/** The signed-in shopper's server-saved wishlist (empty for guests/errors). */
export async function getServerWishlist(): Promise<Product[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.get_wishlist`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const items = (await res.json())?.message?.items;
    return Array.isArray(items) ? (items as Product[]) : [];
  } catch {
    return [];
  }
}

/** Mirror the shopper's wishlist to the server (best-effort; no-op when signed out). */
export async function saveServerWishlist(items: Product[]): Promise<void> {
  if (!BASE) return;
  try {
    await fetch(`${BASE}/api/method/${M}.save_wishlist`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ data: JSON.stringify(items) }),
      credentials: "include",
    });
  } catch {
    /* best-effort — the local wishlist is the fallback */
  }
}
