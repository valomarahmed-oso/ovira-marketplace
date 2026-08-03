/**
 * A seller managing their own shelf.
 *
 * Everything here is scoped server-side to the signed-in vendor — the client
 * never sends "which vendor". `upsert_product` also forces an edited product
 * back to Pending, so nothing on this side can publish itself.
 */

import { fileUrl } from "./config.js";
import { get, post } from "./http.js";
import type { PriceTier } from "./types.js";

const NS = "ovira_marketplace.api.products";
const IMPORT_NS = "ovira_marketplace.api.product_import";

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

/** A row in the seller's product list. */
export type VendorProduct = {
  name: string;
  title: string;
  slug: string;
  price: number;
  compare_at_price?: number | null;
  currency?: string;
  stock_qty: number;
  approval_status: ApprovalStatus;
  published: 0 | 1;
  category?: string | null;
  category_name?: string | null;
  condition?: string | null;
  image?: string | null;
};

/** One sellable option: "Large", or "Large × Red" when the seller uses two axes. */
export type VariantInput = {
  option_value: string;
  option_value2?: string | null;
  price?: number;
  stock_qty?: number;
  sku?: string | null;
};

/** Stock held at one branch, for stores that ship from more than one place. */
export type StockLocation = {
  company: string;
  warehouse: string;
  /** Lets the router prefer the branch nearest the buyer. */
  governorate?: string | null;
  stock_qty?: number;
  priority?: number;
};

/** The same product with everything the edit form needs. */
export type VendorProductDetail = VendorProduct & {
  brand?: string | null;
  track_inventory?: 0 | 1;
  short_description?: string | null;
  description?: string | null;
  images?: string[];
  video_url?: string | null;
  price_tiers?: PriceTier[];
  has_variants?: 0 | 1;
  variant_option_name?: string | null;
  variant_option_name2?: string | null;
  variants?: VariantInput[];
  stock_locations?: StockLocation[];
};

/** What the form sends back. `name` absent means "create". */
export type ProductInput = {
  name?: string;
  title: string;
  price: number;
  compare_at_price?: number | null;
  category?: string | null;
  condition?: string | null;
  brand?: string | null;
  currency?: string | null;
  stock_qty?: number;
  track_inventory?: 0 | 1;
  short_description?: string | null;
  description?: string | null;
  image?: string | null;
  images?: string[];
  video_url?: string | null;
  price_tiers?: PriceTier[];
  has_variants?: 0 | 1;
  variant_option_name?: string | null;
  variant_option_name2?: string | null;
  variants?: VariantInput[];
  stock_locations?: StockLocation[];
};

/** ERPNext companies and their warehouses, for the branch-stock picker. */
export async function listCompanies(): Promise<Array<{ name: string }>> {
  return (await get<Array<{ name: string }>>(`${NS}.list_companies`)) ?? [];
}

export async function listWarehouses(
  company?: string,
): Promise<Array<{ name: string; company: string }>> {
  return (
    (await get<Array<{ name: string; company: string }>>(`${NS}.list_warehouses`, { company })) ?? []
  );
}

export async function myProducts(): Promise<VendorProduct[]> {
  const rows = (await get<VendorProduct[]>(`${NS}.my_products`)) ?? [];
  return rows.map((p) => ({ ...p, image: fileUrl(p.image) ?? null }));
}

export async function getMyProduct(name: string): Promise<VendorProductDetail | null> {
  const doc = await get<VendorProductDetail>(`${NS}.get_my_product`, { name });
  if (!doc) return null;
  return {
    ...doc,
    image: fileUrl(doc.image) ?? null,
    images: (doc.images ?? []).map((i) => fileUrl(i) ?? i),
  };
}

/**
 * Create or update. The controller forces the result back to Pending for a
 * vendor, so this cannot publish anything — approval stays the operator's.
 *
 * Child tables (`images`, `price_tiers`) go up as arrays, the same as the web
 * client sends them; `_apply_gallery` and `_apply_price_tiers` accept either an
 * array or a JSON string.
 */
export function upsertProduct(
  input: ProductInput,
): Promise<{ name: string; approval_status: ApprovalStatus }> {
  return post(`${NS}.upsert_product`, input, "تعذّر حفظ المنتج.");
}

export function deleteProduct(name: string): Promise<unknown> {
  return post(`${NS}.delete_product`, { name }, "تعذّر حذف المنتج.");
}

// -- bulk ------------------------------------------------------------------

export type ImportRowResult = {
  row: number;
  title: string;
  /** `ok` is a dry run's "this would import"; the rest are what happened. */
  status: "ok" | "created" | "updated" | "error";
  message: string;
};

export type ImportResult = {
  dry_run: boolean;
  created: number;
  updated: number;
  errors: number;
  results: ImportRowResult[];
};

/** The header row a seller fills in. */
export async function importTemplate(): Promise<string[]> {
  return (await get<{ columns: string[] }>(`${IMPORT_NS}.import_template`))?.columns ?? [];
}

/** The seller's own products as CSV, ready to edit and re-upload. */
export async function exportMyProductsCsv(): Promise<{ csv: string; count: number }> {
  return (
    (await get<{ csv: string; count: number }>(`${IMPORT_NS}.export_my_products_csv`)) ?? {
      csv: "",
      count: 0,
    }
  );
}

/**
 * `dryRun` is the point of this endpoint, not a nicety: a bad column mapping
 * silently rewriting forty prices is the failure it exists to prevent.
 */
export function importProductsCsv(csvText: string, dryRun = true): Promise<ImportResult> {
  return post(
    `${IMPORT_NS}.import_products_csv`,
    { csv_text: csvText, dry_run: dryRun ? 1 : 0 },
    "تعذّر استيراد الملف.",
  );
}
