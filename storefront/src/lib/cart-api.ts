import { writeHeaders } from "@/lib/frappe-client";
import type { CartItem } from "@/lib/cart-store";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.cart";

/** The signed-in shopper's server-saved cart lines (empty for guests/errors). */
export async function getServerCart(): Promise<CartItem[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.get_cart`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("cart-api", `HTTP ${res.status}`);
      return [];
    }
    const items = (await res.json())?.message?.items;
    return Array.isArray(items) ? (items as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Mirror the shopper's cart to the server (best-effort; no-op when signed out). */
export async function saveServerCart(items: CartItem[]): Promise<void> {
  if (!BASE) return;
  try {
    await fetch(`${BASE}/api/method/${M}.save_cart`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ data: JSON.stringify(items) }),
      credentials: "include",
    });
  } catch {
    /* best-effort — the local cart is the fallback */
  }
}
