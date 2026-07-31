/** Browsing: categories, listings, search, one product. */

import { fileUrl } from "./config.js";
import { get } from "./http.js";
import type { Category, Product, ProductCard } from "./types.js";

const NS = "ovira_marketplace.api.catalog";

export type ProductQuery = {
  category?: string;
  vendor?: string;
  search?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: 0 | 1;
  min_rating?: number;
  sort?: "price_asc" | "price_desc" | "latest" | "rating";
  limit?: number;
  start?: number;
};

/** Route params arrive percent-encoded on both platforms; decode before lookup. */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function withImages<T extends { image?: string | null }>(rows: T[] | null): T[] {
  return (rows ?? []).map((row) => ({ ...row, image: fileUrl(row.image) ?? null }));
}

export async function listProducts(query: ProductQuery = {}): Promise<ProductCard[]> {
  return withImages(await get<ProductCard[]>(`${NS}.list_products`, query as never));
}

export async function listCategories(): Promise<Category[]> {
  const rows = (await get<Category[]>(`${NS}.list_categories`)) ?? [];
  return rows.map((c) => ({ ...c, image: fileUrl(c.image) ?? null }));
}

export type ResolvedCategory = { name: string; slug: string; category_name: string };

/**
 * A category's real name and canonical slug, from a slug of either vintage.
 *
 * Needed because a listing can be legitimately empty, and a screen that titles
 * itself from its first product then has nothing to title itself with — which
 * is how the web store ended up showing shoppers a raw
 * "alkmbywtr-w-mstlzmath" as a heading. The transliteration table stays on the
 * server: a second copy in TypeScript would drift, and the day the two disagree
 * the redirect loops.
 */
export async function resolveCategory(slug: string): Promise<ResolvedCategory | null> {
  return get<ResolvedCategory>(`${NS}.resolve_category`, { slug: decodeSlug(slug) });
}

export async function getProduct(slug: string): Promise<Product | null> {
  const product = await get<Product>(`${NS}.get_product`, { slug: decodeSlug(slug) });
  if (!product) return null;
  return {
    ...product,
    image: fileUrl(product.image) ?? null,
    media: (product.media ?? []).map((m) => ({ ...m, image: fileUrl(m.image) ?? m.image })),
  };
}

export async function relatedProducts(slug: string, limit = 8): Promise<ProductCard[]> {
  return withImages(await get<ProductCard[]>(`${NS}.related_products`, { slug, limit }));
}

/**
 * What `search_suggestions` actually returns per product — not a `ProductCard`.
 *
 * The endpoint builds a deliberately slim row (title, slug, price, currency,
 * image) because a type-ahead list runs on every keystroke. Typing it as a full
 * card was a lie with teeth: `stock_qty` would arrive `undefined`, read as 0,
 * and every suggestion would render with an "out of stock" veil over it.
 */
export type SuggestedProduct = {
  title: string;
  slug: string;
  price: number;
  currency?: string;
  image?: string | null;
};

export type SearchSuggestions = { products: SuggestedProduct[]; categories: Category[] };

/**
 * Type-ahead. Takes an `AbortSignal` because a suggestion for a query the
 * shopper has already typed past is worse than no suggestion — it arrives late
 * and replaces the right answer with a stale one.
 */
export async function searchSuggestions(
  q: string,
  signal?: AbortSignal,
): Promise<SearchSuggestions> {
  const empty: SearchSuggestions = { products: [], categories: [] };
  if (!q.trim()) return empty;
  const res = await get<SearchSuggestions>(`${NS}.search_suggestions`, { q: q.trim() }, { signal });
  if (!res) return empty;
  return { products: withImages(res.products), categories: res.categories ?? [] };
}

export type Facets = { brands: string[]; price_min: number; price_max: number };

export async function catalogFacets(params: { category?: string; search?: string } = {}): Promise<Facets> {
  return (
    (await get<Facets>(`${NS}.catalog_facets`, params)) ?? { brands: [], price_min: 0, price_max: 0 }
  );
}
