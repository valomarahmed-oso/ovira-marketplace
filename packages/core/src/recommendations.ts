/**
 * "People also bought", "popular", "for you".
 *
 * All three are derived from real order lines server-side, and all three
 * legitimately return nothing on a young store — there is no co-purchase data
 * until people have bought pairs of things. Callers must treat empty as normal
 * and simply not render the rail, never as an error worth reporting to a
 * shopper.
 */

import { fileUrl } from "./config.js";
import { get } from "./http.js";
import type { ProductCard } from "./types.js";

const NS = "ovira_marketplace.api.recommendations";

function withImages(rows: ProductCard[] | null): ProductCard[] {
  return (rows ?? []).map((p) => ({ ...p, image: fileUrl(p.image) ?? null }));
}

/** Bought alongside this product. Takes a slug; the server resolves it. */
export async function frequentlyBoughtTogether(slug: string, limit = 4): Promise<ProductCard[]> {
  return withImages(await get<ProductCard[]>(`${NS}.frequently_bought_together`, { slug, limit }));
}

export async function popularProducts(limit = 12): Promise<ProductCard[]> {
  return withImages(await get<ProductCard[]>(`${NS}.popular_products`, { limit }));
}

/**
 * Personalised when there is a session, and merely popular when there is not —
 * the endpoint is guest-safe and decides which it can give. That is why it is
 * called unconditionally rather than gated on being signed in.
 */
export async function recommendedForYou(limit = 12): Promise<ProductCard[]> {
  return withImages(await get<ProductCard[]>(`${NS}.recommended_for_you`, { limit }));
}
