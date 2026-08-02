/** The seller directory, and one seller's public storefront. */

import { fileUrl } from "./config.js";
import { get } from "./http.js";
import type { StoreCard, StoreProfile } from "./types.js";

const NS = "ovira_marketplace.api.vendor";

/**
 * Active sellers that actually have something to sell.
 *
 * The server drops stores with zero published products rather than the client
 * filtering them out, because "0 منتج" cards in a directory are worse than a
 * shorter directory — and because Single Company mode leaves exactly one store
 * standing, a rule only the backend knows.
 */
export async function listStores(
  params: { search?: string; limit?: number } = {},
): Promise<StoreCard[]> {
  const rows = (await get<StoreCard[]>(`${NS}.list_stores`, params as never)) ?? [];
  return rows.map((s) => ({ ...s, logo: fileUrl(s.logo) ?? null }));
}

/**
 * One store's public profile.
 *
 * Returns `null` for a slug that doesn't resolve — a suspended seller throws
 * `DoesNotExistError` server-side, and to a shopper that is the same thing as a
 * store that was never there.
 */
export async function vendorStorefront(slug: string): Promise<StoreProfile | null> {
  const store = await get<StoreProfile>(`${NS}.vendor_storefront`, { slug });
  if (!store) return null;
  return { ...store, logo: fileUrl(store.logo) ?? null, banner: fileUrl(store.banner) ?? null };
}
