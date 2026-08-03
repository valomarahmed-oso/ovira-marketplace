/**
 * The cross-device cart.
 *
 * Same shape as the wishlist mirror and for the same reason: the device's cart
 * is the real one, and the server copy exists so a basket started on the phone
 * can be finished on the website. The blob is the client's own JSON, treated as
 * opaque by the server.
 */

import { get, post } from "./http.js";
import type { CartLine } from "./types.js";

const NS = "ovira_marketplace.api.cart";

/** The signed-in shopper's saved cart. Empty for guests and on any failure. */
export async function getServerCart(): Promise<CartLine[]> {
  const res = await get<{ items: CartLine[] }>(`${NS}.get_cart`);
  return Array.isArray(res?.items) ? res.items : [];
}

/** Best-effort: a failed sync must never disturb the cart on the device. */
export async function saveServerCart(items: CartLine[]): Promise<void> {
  try {
    await post(`${NS}.save_cart`, { data: JSON.stringify(items) });
  } catch {
    /* the device's copy is the one that matters, and it is already correct */
  }
}

/**
 * Union two carts by line identity (slug + variant), local first.
 *
 * Quantities are **not** added together. Someone who put two of something in
 * on their phone and two on the website wants two, not four — they are the same
 * intention recorded twice, not two separate decisions. Taking the larger of
 * the two is the reading that never silently inflates an order.
 */
export function mergeCarts(local: CartLine[], remote: CartLine[]): CartLine[] {
  const keyOf = (line: CartLine) => `${line.slug}::${line.variant ?? ""}`;
  const merged = new Map(local.map((line) => [keyOf(line), line]));
  for (const line of remote) {
    const key = keyOf(line);
    const mine = merged.get(key);
    if (!mine) {
      merged.set(key, line);
    } else if (line.qty > mine.qty) {
      merged.set(key, { ...mine, qty: line.qty });
    }
  }
  return [...merged.values()];
}
