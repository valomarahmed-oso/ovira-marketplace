/** Flash deals — the public feed. */

import { fileUrl } from "./config.js";
import { get } from "./http.js";
import type { ProductCard } from "./types.js";

const NS = "ovira_marketplace.api.deals";

/**
 * Products with a live flash deal, soonest to expire first.
 *
 * The cards come back already carrying `price` at the deal rate plus
 * `deal_ends_on` — the deal is not a separate object the client has to apply.
 * That matters: a client that did its own subtraction would be a second place
 * where a price is decided, and the invoice would eventually disagree with it.
 */
export async function listDeals(limit = 24): Promise<ProductCard[]> {
  const rows = (await get<ProductCard[]>(`${NS}.list_deals`, { limit })) ?? [];
  return rows.map((p) => ({ ...p, image: fileUrl(p.image) ?? null }));
}
