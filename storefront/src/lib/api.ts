import { getAttribution } from "@/lib/attribution";
import { writeHeaders } from "@/lib/frappe-client";
import type { Locale } from "@/lib/i18n";
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
  vendor_slug?: string | null;
  vendor_trust_tier?: string | null;
  vendor_trust_score?: number | null;
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
  has_variants?: number | boolean;
  variant_option_name?: string;
  variants?: ProductVariant[];
  // Set when a live flash deal overlays the price (single-price products only).
  deal_ends_on?: string;
  deal_remaining?: number | null;
  deal?: { deal_price: number; ends_on: string; remaining: number | null };
  // Set on cards returned by the sponsored strip: `placement` attributes a click.
  sponsored?: boolean;
  placement?: string;
};

export type ProductVariant = {
  option_value: string;
  sku: string;
  price: number;
  stock_qty: number;
  image?: string | null;
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
  vendor?: string;
  search?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  minRating?: number;
  sort?: string;
  limit?: number;
};

export type Facets = { brands: string[]; price_min: number; price_max: number };

export async function getProducts(params: ProductQuery = {}): Promise<Product[]> {
  const qs: Record<string, string> = { limit: String(params.limit ?? 24) };
  if (params.category) qs.category = params.category;
  if (params.vendor) qs.vendor = params.vendor;
  if (params.search) qs.search = params.search;
  if (params.brand) qs.brand = params.brand;
  if (params.minPrice != null) qs.min_price = String(params.minPrice);
  if (params.maxPrice != null) qs.max_price = String(params.maxPrice);
  if (params.inStock) qs.in_stock = "1";
  if (params.minRating != null) qs.min_rating = String(params.minRating);
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
    minRating: get("rating") ? Number(get("rating")) : undefined,
    sort: get("sort") || undefined,
  };
}

/** Behind the /shop basePath + proxy, non-ASCII route params (e.g. Arabic
 * slugs) can arrive still percent-encoded; URLSearchParams would then encode
 * them again and the server lookup misses. Decoding first is safe — a plain
 * Arabic/ascii slug has no `%`, so this is a no-op for it. */
function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  slug = decodeSlug(slug);
  const live = await callMethod<Product>("ovira_marketplace.api.catalog.get_product", { slug });
  if (live) return live;
  return USE_MOCKS ? mockDetail(slug) : null;
}

export type VendorStore = {
  name: string;
  vendor_name: string;
  slug: string;
  logo?: string | null;
  banner?: string | null;
  description?: string | null;
  return_policy?: string | null;
  shipping_policy?: string | null;
  rating?: number | null;
  ratings_count?: number | null;
  trust_score?: number | null;
  trust_tier?: string | null;
  orders_count?: number | null;
  product_count: number;
  creation: string;
};

/** Public seller storefront by slug (Active stores only). Null when not found. */
export async function getVendorStore(slug: string): Promise<VendorStore | null> {
  return callMethod<VendorStore>("ovira_marketplace.api.vendor.vendor_storefront", { slug });
}

export type StoreCard = {
  name: string;
  vendor_name: string;
  slug: string;
  logo?: string | null;
  rating?: number | null;
  ratings_count?: number | null;
  trust_score?: number | null;
  trust_tier?: string | null;
  orders_count?: number | null;
  product_count: number;
};

/** Public directory of Active stores that have at least one published product. */
export async function getStores(search?: string): Promise<StoreCard[]> {
  const live = await callMethod<StoreCard[]>(
    "ovira_marketplace.api.vendor.list_stores",
    search ? { search } : {},
  );
  return live ?? [];
}

/** Products related to `slug` (same category → vendor → newest). */
export async function getRelatedProducts(slug: string, limit = 8): Promise<Product[]> {
  const live = await callMethod<Product[]>("ovira_marketplace.api.catalog.related_products", {
    slug,
    limit: String(limit),
  });
  if (live !== null) return live;
  return USE_MOCKS ? mockProducts({ limit }).filter((p) => p.slug !== slug) : [];
}

/** Products frequently bought together with `slug` (order co-occurrence). Empty
 * when there isn't enough purchase history yet. */
export async function getFrequentlyBoughtTogether(slug: string, limit = 4): Promise<Product[]> {
  const live = await callMethod<Product[]>(
    "ovira_marketplace.api.recommendations.frequently_bought_together",
    { slug, limit: String(limit) },
  );
  return live ?? [];
}

export type SearchSuggestion = {
  products: { title: string; slug: string; price: number; currency: string; image?: string }[];
  categories: { category_name: string; slug: string }[];
};

/** Autocomplete for the header search box. Returns empty for a too-short query or
 * an unreachable backend (the dropdown just stays closed). */
export async function getSearchSuggestions(q: string): Promise<SearchSuggestion> {
  const empty: SearchSuggestion = { products: [], categories: [] };
  if (!BASE || q.trim().length < 2) return empty;
  try {
    const res = await fetch(
      `${BASE}/api/method/ovira_marketplace.api.catalog.search_suggestions?q=${encodeURIComponent(q.trim())}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return empty;
    return ((await res.json()).message as SearchSuggestion) ?? empty;
  } catch {
    return empty;
  }
}

/** Products with a live flash deal, soonest to end first. */
export async function getDeals(limit = 24): Promise<Product[]> {
  const live = await callMethod<Product[]>("ovira_marketplace.api.deals.list_deals", {
    limit: String(limit),
  });
  return live ?? [];
}

export async function getCategories() {
  const live = await callMethod<Category[]>("ovira_marketplace.api.catalog.list_categories");
  if (live && live.length) return live;
  return USE_MOCKS ? MOCK_CATEGORIES : (live ?? []);
}

export type Banner = {
  name?: string;
  title: string;
  title_en?: string;
  subtitle?: string;
  subtitle_en?: string;
  image?: string;
  link?: string;
  cta_label?: string;
  cta_label_en?: string;
  tone?: string;
  placement?: string;
};

/** Collapse a bilingual banner to the active locale: for `en`, prefer the `_en`
 *  variant then fall back to the Arabic base; for `ar`, use the base. */
export function localizeBanner(banner: Banner, locale: Locale): Banner {
  if (locale !== "en") return banner;
  const pick = (base?: string, en?: string) => (en && en.trim() ? en : base);
  return {
    ...banner,
    title: pick(banner.title, banner.title_en) ?? banner.title,
    subtitle: pick(banner.subtitle, banner.subtitle_en),
    cta_label: pick(banner.cta_label, banner.cta_label_en),
  };
}

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
  onlinePayment: boolean;
};

const DEFAULT_CONFIG: AppConfig = {
  multiVendor: true,
  currency: "EGP",
  autoApproveVendors: false,
  onlinePayment: false,
};

export type SiteContent = {
  brand_name?: string;
  brand_name_en?: string;
  footer_tagline?: string;
  footer_tagline_en?: string;
  support_email?: string;
  hero_badge?: string;
  hero_badge_en?: string;
  about_content?: string;
  about_content_en?: string;
  careers_content?: string;
  careers_content_en?: string;
  terms_content?: string;
  terms_content_en?: string;
  privacy_content?: string;
  privacy_content_en?: string;
};

/** Operator-editable site chrome + content pages. Empty fields fall back to the
 * storefront's built-in defaults. Carries both the Arabic base fields and their
 * English (_en) variants; use {@link localizeSiteContent} to collapse to a locale. */
export async function getSiteContent(): Promise<SiteContent> {
  const live = await callMethod<SiteContent>("ovira_marketplace.api.cms.get_site_content", {});
  return live ?? {};
}

/** Collapse the bilingual SiteContent to the active locale: for `en`, prefer the
 *  `_en` variant then fall back to the Arabic base; for `ar`, use the base value.
 *  The returned object exposes only the base field names (brand_name, …), each
 *  already holding the right-language string. */
export function localizeSiteContent(content: SiteContent, locale: Locale): SiteContent {
  if (locale !== "en") return content;
  const pick = (base?: string, en?: string) => (en && en.trim() ? en : base);
  return {
    ...content,
    brand_name: pick(content.brand_name, content.brand_name_en),
    footer_tagline: pick(content.footer_tagline, content.footer_tagline_en),
    hero_badge: pick(content.hero_badge, content.hero_badge_en),
    about_content: pick(content.about_content, content.about_content_en),
    careers_content: pick(content.careers_content, content.careers_content_en),
    terms_content: pick(content.terms_content, content.terms_content_en),
    privacy_content: pick(content.privacy_content, content.privacy_content_en),
  };
}

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
      online_payment: boolean;
    };
    return {
      multiVendor: !!live.multi_vendor,
      currency: live.currency || "EGP",
      autoApproveVendors: !!live.auto_approve_vendors,
      onlinePayment: !!live.online_payment,
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

/** Live shipping quote for the whole cart, honouring the active shipping mode
 * (operator rate table, or the sum of each vendor's own rate in Per-Vendor mode).
 * Prices are resolved server-side, so pass just {slug, qty, variant}. */
export async function previewShipping(
  items: { slug: string; qty: number; variant?: string }[],
  governorate?: string,
): Promise<number | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.shipping.preview`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ items, governorate }),
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const v = (await res.json()).message;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Validate a coupon against a subtotal. Returns the discount, or an error
 * message the shopper can act on (e.g. expired / below minimum). */
export async function validateCoupon(
  code: string,
  subtotal: number,
): Promise<{ discount: number } | { error: string }> {
  if (!BASE) return { error: "الخدمة غير متاحة حاليًا." };
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.coupons.validate_coupon`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ code, subtotal }),
      credentials: "include",
    });
    if (!res.ok) {
      let error = "كوبون غير صالح.";
      try {
        const data = await res.json();
        const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
        if (raw) error = JSON.parse(raw).message ?? error;
      } catch {
        /* ignore */
      }
      return { error };
    }
    const msg = (await res.json()).message;
    return { discount: Number(msg?.discount) || 0 };
  } catch {
    return { error: "تعذّر التحقق من الكوبون." };
  }
}

export type CheckoutPayload = {
  items: { slug: string; qty: number; variant?: string }[];
  customer: { name: string; phone: string; email?: string; gov: string; address: string };
  payment_method: string;
  payment_method_ref?: string;
  coupon?: string;
  use_wallet?: boolean;
};

export async function placeOrder(
  payload: CheckoutPayload,
): Promise<{ name: string; token?: string } | null> {
  if (!BASE) return null;
  try {
    // Attach first-touch marketing attribution (best-effort) so the order is
    // credited to the channel that acquired the shopper.
    const attribution = getAttribution();
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.checkout.place_order`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(attribution ? { ...payload, attribution } : payload),
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message ?? null;
  } catch {
    return null;
  }
}

export type TrackedOrderItem = {
  title: string;
  qty: number;
  rate: number;
  amount: number;
  image?: string | null;
};

export type TrackedOrder = {
  name: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  payment_method_ref?: string | null;
  currency?: string;
  subtotal: number;
  shipping_amount: number;
  discount_amount: number;
  coupon_code?: string | null;
  wallet_applied?: number;
  total: number;
  customer_name?: string;
  governorate?: string;
  delivery_confirmed?: number;
  delivered_on?: string | null;
  creation: string;
  item_count: number;
  items: TrackedOrderItem[];
};

/** Public order tracking. Proof (token / phone / email) goes in the POST body,
 *  never the URL, so personal details stay out of query strings and logs. */
export async function trackOrder(
  name: string,
  proof: { token?: string; email?: string; phone?: string },
): Promise<TrackedOrder | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.orders.track_order`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ name, ...proof }),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()).message ?? null;
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
