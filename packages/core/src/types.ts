/**
 * The domain, as the backend actually returns it.
 *
 * Field names are snake_case on purpose: these mirror Frappe doctypes, and
 * renaming them here would mean a translation layer that has to be kept correct
 * in two directions forever. The friction of `stock_qty` in a React component is
 * cheaper than that.
 */

export type Locale = "ar" | "en";

// -- catalog ---------------------------------------------------------------

export type ProductCard = {
  name: string;
  title: string;
  slug: string;
  price: number;
  compare_at_price?: number | null;
  currency?: string;
  vendor?: string;
  vendor_name?: string | null;
  vendor_trust_score?: number | null;
  vendor_trust_tier?: string | null;
  category?: string | null;
  brand?: string | null;
  stock_qty: number;
  rating?: number;
  review_count?: number;
  has_variants?: 0 | 1;
  image?: string | null;
  /** Present only while a flash deal is live on this product. */
  deal_ends_on?: string | null;
  deal_remaining?: number | null;
};

export type ProductMedia = { image: string; is_primary?: 0 | 1 };

export type ProductVariant = {
  name: string;
  option_value: string;
  sku?: string | null;
  price?: number;
  stock_qty: number;
};

export type Product = ProductCard & {
  short_description?: string | null;
  description?: string | null;
  media?: ProductMedia[];
  variants?: ProductVariant[];
  video_url?: string | null;
  vendor_slug?: string | null;
  track_inventory?: 0 | 1;
};

export type Category = {
  name: string;
  category_name: string;
  slug: string;
  icon?: string | null;
  image?: string | null;
  is_group?: 0 | 1;
  display_order?: number;
};

// -- cart ------------------------------------------------------------------

/** A line as the app holds it locally, before the server re-prices anything. */
export type CartLine = {
  slug: string;
  title: string;
  price: number;
  qty: number;
  image?: string | null;
  /** Chosen variant SKU, when the product has options. */
  variant?: string | null;
  variantLabel?: string | null;
  vendor_name?: string | null;
  /** What the shop said was available when this line was added. */
  stock_qty?: number;
};

// -- orders ----------------------------------------------------------------

export type OrderStatus =
  | "Pending Payment"
  | "Paid"
  | "Processing"
  | "Shipped"
  | "Completed"
  | "Cancelled";

export type OrderItem = {
  marketplace_product?: string;
  title: string;
  vendor?: string;
  qty: number;
  rate: number;
  amount: number;
  image?: string;
};

export type Order = {
  name: string;
  status: OrderStatus;
  payment_status: string;
  payment_method?: string;
  currency?: string;
  subtotal: number;
  shipping_amount: number;
  discount_amount?: number;
  coupon_code?: string;
  wallet_applied?: number;
  /** Tax as billed. `tax_inclusive` means it is already inside `total`. */
  net_total?: number;
  tax_amount?: number;
  tax_rate?: number;
  tax_inclusive?: 0 | 1 | boolean;
  total: number;
  creation: string;
  customer_name?: string;
  governorate?: string;
  shipping_address?: string;
  shipping_method?: string | null;
  shipping_eta_min?: number;
  shipping_eta_max?: number;
  delivery_confirmed?: 0 | 1;
  delivered_on?: string | null;
  items?: OrderItem[];
  return_status?: string | null;
};

// -- identity --------------------------------------------------------------

export type SessionUser = {
  email: string;
  name: string;
  roles: string[];
  isVendor: boolean;
  isOperator: boolean;
  vendor?: string | null;
  vendorStatus?: string | null;
};

// -- store configuration ---------------------------------------------------

/** Display only — the charge is always recomputed server-side. */
export type TaxDisclosure = { rate: number; inclusive: boolean; label?: string | null };

export type StoreConfig = {
  multiVendor: boolean;
  currency: string;
  onlinePayment: boolean;
  shippingMode: "Operator" | "Per Vendor";
  tax: TaxDisclosure | null;
};
