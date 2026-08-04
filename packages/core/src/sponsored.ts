/**
 * Paid placements — the operator's ad inventory.
 *
 * This is revenue, not merchandising: the operator bills an advertiser per
 * click, so a client that renders the strip and never reports the click bills
 * nobody. Both halves belong together, which is why they live in one module.
 */

import { fileUrl } from "./config.js";
import { get, post } from "./http.js";
import type { ProductCard } from "./types.js";

const NS = "ovira_marketplace.api.sponsored";

/** A product card that was paid for, carrying the placement it was paid under. */
export type SponsoredCard = ProductCard & {
  sponsored?: boolean;
  /** The id a click is attributed to. Without it there is nothing to bill. */
  placement?: string | null;
};

/**
 * The strip for a listing. A placement with a `target_category` shows only on
 * that category; a blank one shows everywhere, so passing no category is not
 * "all placements" but "the catalogue-wide ones".
 */
export async function sponsoredProducts(
  category?: string,
  limit = 8,
): Promise<SponsoredCard[]> {
  const rows = (await get<SponsoredCard[]>(`${NS}.sponsored_products`, { category, limit })) ?? [];
  return rows.map((p) => ({ ...p, image: fileUrl(p.image) ?? null }));
}

/**
 * Attribute a tap to a placement. Deliberately fire-and-forget: a billing
 * beacon must never delay opening the product, and a shopper must never see an
 * error because an ad counter failed.
 */
export function recordSponsoredClick(placement: string): void {
  void post(`${NS}.record_sponsored_click`, { placement }).catch(() => {});
}
