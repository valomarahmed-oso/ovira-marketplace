/**
 * The cross-device wishlist.
 *
 * The list itself lives on the device — a guest has one, and it must survive
 * being signed out. The server copy is a *mirror*, so the same saved items turn
 * up on the phone and on the website. The blob is the client's own JSON and the
 * server treats it as opaque, which is why the shape below is the client's to
 * agree on rather than the backend's to define.
 */

import { fileUrl } from "./config.js";
import { get, post } from "./http.js";
import type { ProductCard } from "./types.js";

const NS = "ovira_marketplace.api.wishlist";

/** The signed-in shopper's saved items. Empty for guests, and on any failure. */
export async function getServerWishlist(): Promise<ProductCard[]> {
  const res = await get<{ items: ProductCard[] }>(`${NS}.get_wishlist`);
  const items = Array.isArray(res?.items) ? res.items : [];
  return items.map((p) => ({ ...p, image: fileUrl(p.image) ?? null }));
}

/**
 * Mirror the wishlist up. Best-effort on purpose: a failed sync must not lose
 * the local list or interrupt what the shopper was doing.
 */
export async function saveServerWishlist(items: ProductCard[]): Promise<void> {
  try {
    await post(`${NS}.save_wishlist`, { data: JSON.stringify(items) });
  } catch {
    /* the device's copy is the fallback, and it is already correct */
  }
}

/**
 * Union two wishlists by slug, local order first. Idempotent.
 *
 * Merge rather than replace: signing in on a new phone should not delete what
 * was saved on it, and it should not delete what was saved elsewhere either.
 */
export function mergeWishlists(local: ProductCard[], remote: ProductCard[]): ProductCard[] {
  const seen = new Set(local.map((i) => i.slug));
  return [...local, ...remote.filter((i) => !seen.has(i.slug))];
}
