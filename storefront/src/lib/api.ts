import { writeHeaders } from "@/lib/frappe-client";
import { MOCK_CATEGORIES, mockDetail, mockHomepage, mockProducts } from "@/lib/mock-data";

// Mock fallbacks are dev-only; in production the bundler tree-shakes them out and
// an unreachable backend yields empty state rather than fabricated products.
const USE_MOCKS = process.env.NODE_ENV !== "production";

export type Product = {
  name: string;
  title: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  currency: string;
  vendor: string;
  vendor_name?: string;
  category?: string;
  brand?: string;
  stock_qty: number;
  image?: string;
  rating?: number;
  reviews?: number;
  short_description?: string;
  description?: string;
  media?: { image: string; alt_text?: string }[];
  attributes?: { attribute: string; value: string }[];
};

export type Category = {
  name: string;
  category_name: string;
  slug: string;
  icon?: string;
  image?: string;
};

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

async function callMethod<T>(method: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!BASE) return null;
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${BASE}/api/method/${method}${qs ? `?${qs}` : ""}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message as T;
  } catch {
    return null;
  }
}

export type ProductQuery = {
  category?: string;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: string;
  limit?: number;
};

export type Facets = { brands: string[]; price_min: number; price_max: number };

export async function getProducts(params: ProductQuery = {}): Promise<Product[]> {
  const qs: Record<string, string> = { limit: String(params.limit ?? 24) };
  if (params.category) qs.category = params.category;
  if (params.search) qs.search = params.search;
  if (params.brand) qs.brand = params.brand;
  if (params.minPrice != null) qs.min_price = String(params.minPrice);
  if (params.maxPrice != null) qs.max_price = String(params.maxPrice);
  if (params.inStock) qs.in_stock = "1";
  if (params.sort) qs.sort = params.sort;

  const live = await callMethod<Product[]>("ovira_marketplace.api.catalog.list_products", qs);
  if (live !== null) return live;
  return USE_MOCKS ? mockProducts(params) : [];
}

export async function getFacets(params: { category?: string; search?: string } = {}): Promise<Facets> {
  const qs: Record<string, string> = {};
  if (params.category) qs.category = params.category;
  if (params.search) qs.search = params.search;
  const live = await callMethod<Facets>("ovira_marketplace.api.catalog.catalog_facets", qs);
  if (live) return live;
  if (!USE_MOCKS) return { brands: [], price_min: 0, price_max: 0 };

  const list = mockProducts({ category: params.category, search: params.search, limit: 999 });
  const prices = list.map((p) => p.price);
  return {
    brands: Array.from(new Set(list.map((p) => p.brand).filter(Boolean))) as string[],
    price_min: prices.length ? Math.floor(Math.min(...prices)) : 0,
    price_max: prices.length ? Math.ceil(Math.max(...prices)) : 0,
  };
}

/** Turn a Next.js route searchParams object into a ProductQuery. */
export function searchParamsToQuery(
  sp: Record<string, string | string[] | undefined>,
): ProductQuery {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    brand: get("brand") || undefined,
    minPrice: get("min") ? Number(get("min")) : undefined,
    maxPrice: get("max") ? Number(get("max")) : undefined,
    inStock: get("stock") === "1",
    sort: get("sort") || undefined,
  };
}

export async function getProduct(slug: string): Promise<Product | null> {
  const live = await callMethod<Product>("ovira_marketplace.api.catalog.get_product", { slug });
  if (live) return live;
  return USE_MOCKS ? mockDetail(slug) : null;
}

export async function getCategories() {
  const live = await callMethod<Category[]>("ovira_marketplace.api.catalog.list_categories");
  if (live && live.length) return live;
  return USE_MOCKS ? MOCK_CATEGORIES : (live ?? []);
}

export type Banner = {
  name?: string;
  title: string;
  subtitle?: string;
  image?: string;
  link?: string;
  cta_label?: string;
  tone?: string;
  placement?: string;
};

export type HomeSection = { heading: string; link?: string; products: Product[] };

export type Homepage = {
  hero: Banner[];
  promos: Banner[];
  deal: Product | null;
  sections: HomeSection[];
};

export type AppConfig = {
  multiVendor: boolean;
  currency: string;
  autoApproveVendors: boolean;
};

const DEFAULT_CONFIG: AppConfig = { multiVendor: true, currency: "EGP", autoApproveVendors: false };

export async function getAppConfig(): Promise<AppConfig> {
  if (!BASE) return DEFAULT_CONFIG;
  // Short-lived cache: this gates vendor-facing UI, but a blocking uncached fetch
  // on every page render is wasteful. 30s keeps a mode switch near-immediate while
  // sparing the backend a hit per render.
  try {
    const res = await fetch(
      `${BASE}/api/method/ovira_marketplace.api.settings.get_public_config`,
      { headers: { Accept: "application/json" }, next: { revalidate: 30 } },
    );
    if (!res.ok) return DEFAULT_CONFIG;
    const live = (await res.json()).message as {
      multi_vendor: boolean;
      currency: string;
      auto_approve_vendors: boolean;
    };
    return {
      multiVendor: !!live.multi_vendor,
      currency: live.currency || "EGP",
      autoApproveVendors: !!live.auto_approve_vendors,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function getHomepage(): Promise<Homepage> {
  const live = await callMethod<Homepage>("ovira_marketplace.api.cms.get_homepage");
  if (live && (live.hero?.length || live.promos?.length || live.sections?.length)) return live;
  return USE_MOCKS ? mockHomepage() : { hero: [], promos: [], deal: null, sections: [] };
}

/** Live shipping fee from the configured provider. Null = backend unreachable
 * (caller falls back to the local estimate). */
export async function getShippingRate(
  subtotal: number,
  governorate?: string,
): Promise<number | null> {
  if (!BASE) return null;
  try {
    const qs = new URLSearchParams({ subtotal: String(subtotal) });
    if (governorate) qs.set("governorate", governorate);
    const res = await fetch(
      `${BASE}/api/method/ovira_marketplace.api.shipping.get_rate?${qs}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const v = (await res.json()).message;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export type CheckoutPayload = {
  items: { slug: string; qty: number }[];
  customer: { name: string; phone: string; email?: string; gov: string; address: string };
  payment_method: string;
};

export async function placeOrder(
  payload: CheckoutPayload,
): Promise<{ name: string; token?: string } | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.checkout.place_order`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message ?? null;
  } catch {
    return null;
  }
}

export async function initiatePayment(
  order: string,
  token: string | undefined,
  returnUrl: string,
): Promise<{ method?: string; redirect_url?: string } | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.payment.create_payment`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ order, token, return_url: returnUrl }),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()).message ?? null;
  } catch {
    return null;
  }
}
