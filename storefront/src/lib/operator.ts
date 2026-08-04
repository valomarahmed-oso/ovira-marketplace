import { writeHeaders } from "@/lib/frappe-client";
import type { WalletEntry } from "@/lib/wallet-api";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type VendorStatus = "Pending" | "Active" | "Suspended" | "Draft";

export type Vendor = {
  name: string;
  vendor_name: string;
  slug?: string;
  status: VendorStatus;
  email?: string;
  phone?: string;
  user?: string;
  supplier?: string;
  customer?: string;
  commission_rate?: number;
  trust_score?: number;
  trust_tier?: string;
  rating?: number;
  creation?: string;
};

export type VendorCounts = Record<string, number>;

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
    if (raw) return JSON.parse(raw).message ?? fallback;
    if (data?.exception) return String(data.exception).replace(/^[^:]+:\s*/, "");
  } catch {
    /* ignore */
  }
  return fallback;
}

const opUrl = (method: string, qs?: URLSearchParams) =>
  `${BASE}/api/method/ovira_marketplace.api.operator.${method}${qs ? `?${qs}` : ""}`;

/**
 * The wallet endpoints live in `api.wallet`, not `api.operator`.
 *
 * They were called through `opUrl` for months, which resolved to
 * `api.operator.user_wallet` — a method that does not exist. Every lookup 404'd,
 * the client degraded a failed read to `null`, and the screen reported "no user
 * with that email" for customers who plainly had one. Adjusting a balance was
 * broken the same way and just as silently.
 */
const walletUrl = (method: string, qs?: URLSearchParams) =>
  `${BASE}/api/method/ovira_marketplace.api.wallet.${method}${qs ? `?${qs}` : ""}`;

export async function listVendors(params: { status?: string; search?: string } = {}): Promise<Vendor[]> {
  if (!BASE) return [];
  const qs = new URLSearchParams();
  if (params.status && params.status !== "All") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  try {
    const res = await fetch(opUrl("list_vendors", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Vendor[];
  } catch (err) {
    reportApiFailure("operator", err);
    return [];
  }
}

export async function vendorStatusCounts(): Promise<VendorCounts> {
  if (!BASE) return {};
  try {
    const res = await fetch(opUrl("vendor_status_counts"), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return {};
    }
    return ((await res.json()).message ?? {}) as VendorCounts;
  } catch (err) {
    reportApiFailure("operator", err);
    return {};
  }
}

export async function setVendorStatus(
  name: string,
  status: VendorStatus,
): Promise<{ name: string; status: VendorStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("set_vendor_status"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ name, status }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message;
}

export type LowStockProduct = {
  name: string;
  title: string;
  stock_qty: number;
  low_stock_threshold: number;
  vendor?: string;
  vendor_name?: string;
};

/** Tracked products at or below their low-stock threshold (reorder list). */
export async function lowStockProducts(limit = 100): Promise<LowStockProduct[]> {
  if (!BASE) return [];
  const qs = new URLSearchParams({ limit: String(limit) });
  try {
    const res = await fetch(opUrl("low_stock_products", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as LowStockProduct[];
  } catch (err) {
    reportApiFailure("operator", err);
    return [];
  }
}

/** Replenish a tracked product's ERPNext stock; returns the new quantities. */
export async function restockProduct(
  product: string,
  qty: number,
  opts: { supplier?: string; rate?: number } = {},
): Promise<{ voucher: string; bin_qty: number; stock_qty: number }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("restock_product"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ product, qty, supplier: opts.supplier, rate: opts.rate }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر التخزين."));
  return (await res.json()).message;
}

export async function bulkSetVendorStatus(
  names: string[],
  status: VendorStatus,
): Promise<{ updated: number; failed: string[]; status: VendorStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("bulk_set_vendor_status"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ names: JSON.stringify(names), status }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message;
}

// --- Products (moderation) -------------------------------------------------

export type ProductApprovalStatus = "Pending" | "Approved" | "Rejected" | "Draft";

export type AdminProduct = {
  name: string;
  title: string;
  slug?: string;
  vendor?: string;
  vendor_name?: string | null;
  approval_status: ProductApprovalStatus;
  published?: number;
  price?: number;
  currency?: string;
  stock_qty?: number;
  image?: string | null;
  creation?: string;
};

/** Absolute URL for a Frappe /files path (images are served at the API origin). */
export function fileUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function listProducts(params: { status?: string; search?: string } = {}): Promise<AdminProduct[]> {
  if (!BASE) return [];
  const qs = new URLSearchParams();
  if (params.status && params.status !== "All") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  try {
    const res = await fetch(opUrl("list_products", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as AdminProduct[];
  } catch (err) {
    reportApiFailure("operator", err);
    return [];
  }
}

export async function productStatusCounts(): Promise<VendorCounts> {
  if (!BASE) return {};
  try {
    const res = await fetch(opUrl("product_status_counts"), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return {};
    }
    return ((await res.json()).message ?? {}) as VendorCounts;
  } catch (err) {
    reportApiFailure("operator", err);
    return {};
  }
}

export async function setProductStatus(
  name: string,
  status: ProductApprovalStatus,
  rejectionReason?: string,
): Promise<{ name: string; approval_status: ProductApprovalStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("set_product_status"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ name, status, rejection_reason: rejectionReason ?? "" }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message;
}

export async function bulkSetProductStatus(
  names: string[],
  status: ProductApprovalStatus,
  rejectionReason?: string,
): Promise<{ updated: number; failed: string[]; status: ProductApprovalStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("bulk_set_product_status"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ names: JSON.stringify(names), status, rejection_reason: rejectionReason ?? "" }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message;
}

// --- Orders ----------------------------------------------------------------

export type OrderStatus =
  | "Pending Payment"
  | "Paid"
  | "Processing"
  | "Shipped"
  | "Completed"
  | "Cancelled";
export type PaymentStatus = "Unpaid" | "Paid" | "Refunded";

export type AdminOrder = {
  name: string;
  customer_name?: string;
  phone?: string;
  status: OrderStatus;
  payment_status?: PaymentStatus;
  total?: number;
  currency?: string;
  source?: string;
  creation?: string;
  item_count?: number;
};

export type SourceRow = {
  source: string;
  orders: number;
  revenue: number;
  paid_revenue: number;
};

export type SourceBreakdown = {
  days: number;
  total_orders: number;
  breakdown: SourceRow[];
};

export async function getSourceBreakdown(days = 30): Promise<SourceBreakdown | null> {
  if (!BASE) return null;
  const qs = new URLSearchParams({ days: String(days) });
  try {
    const res = await fetch(opUrl("source_breakdown", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as SourceBreakdown | null;
  } catch (err) {
    reportApiFailure("operator", err);
    return null;
  }
}

export type AdminOrderItem = {
  marketplace_product?: string;
  title?: string;
  vendor?: string;
  vendor_name?: string | null;
  qty?: number;
  rate?: number;
  amount?: number;
};

export type AdminOrderDetail = AdminOrder & {
  email?: string;
  governorate?: string;
  shipping_address?: string;
  payment_method?: string;
  subtotal?: number;
  shipping_amount?: number;
  delivery_confirmed?: number;
  delivered_on?: string;
  items: AdminOrderItem[];
};

export async function listOrders(params: { status?: string; search?: string } = {}): Promise<AdminOrder[]> {
  if (!BASE) return [];
  const qs = new URLSearchParams();
  if (params.status && params.status !== "All") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  try {
    const res = await fetch(opUrl("list_orders", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as AdminOrder[];
  } catch (err) {
    reportApiFailure("operator", err);
    return [];
  }
}

export async function orderStatusCounts(): Promise<VendorCounts> {
  if (!BASE) return {};
  try {
    const res = await fetch(opUrl("order_status_counts"), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return {};
    }
    return ((await res.json()).message ?? {}) as VendorCounts;
  } catch (err) {
    reportApiFailure("operator", err);
    return {};
  }
}

export async function getOrder(name: string): Promise<AdminOrderDetail | null> {
  if (!BASE) return null;
  const qs = new URLSearchParams({ name });
  try {
    const res = await fetch(opUrl("get_order", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as AdminOrderDetail | null;
  } catch (err) {
    reportApiFailure("operator", err);
    return null;
  }
}

export async function setOrderStatus(
  name: string,
  status: OrderStatus,
): Promise<{ name: string; status: OrderStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("set_order_status"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ name, status }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message;
}

// --- Payouts ---------------------------------------------------------------

export type VendorPayout = {
  vendor: string;
  vendor_name: string;
  supplier: string;
  status: VendorStatus;
  balance_due: number;
  currency?: string;
};

export async function vendorPayouts(): Promise<VendorPayout[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(opUrl("vendor_payouts"), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as VendorPayout[];
  } catch (err) {
    reportApiFailure("operator", err);
    return [];
  }
}

export async function payVendor(
  vendor: string,
): Promise<{ paid: boolean; payment_entry?: string; message?: string }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("pay_vendor"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ vendor }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ الصرف."));
  return (await res.json()).message;
}

export async function runAllPayouts(): Promise<{ count: number; payment_entries: string[] }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("run_all_payouts"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({}),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ الصرف."));
  return (await res.json()).message;
}

// --- Accounting recovery ---------------------------------------------------

export type FailedAccountingOrder = {
  name: string;
  customer_name?: string;
  total?: number;
  currency?: string;
  creation?: string;
  accounting_error?: string;
};

export async function failedAccountingOrders(): Promise<FailedAccountingOrder[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(opUrl("failed_accounting_orders"), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as FailedAccountingOrder[];
  } catch (err) {
    reportApiFailure("operator", err);
    return [];
  }
}

export async function retryOrderAccounting(
  order: string,
): Promise<{ order: string; ok: boolean; accounting_status: string }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("retry_order_accounting"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ order }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر إعادة المحاولة."));
  return (await res.json()).message;
}

/** Re-create the ERPNext Sales Orders an order points at, when they were deleted
 *  from the Desk. Plain retry can never fix that — the document is gone. */
export async function rebuildVendorOrders(
  order: string,
): Promise<{ order: string; relinked: number; accounting_status: string; booked: boolean }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(
    `${BASE}/api/method/ovira_marketplace.api.payment.rebuild_vendor_orders`,
    {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ order_name: order }),
      credentials: "include",
    },
  );
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر إعادة إنشاء أوامر البيع."));
  return (await res.json()).message;
}

// --- COD / manual collection -------------------------------------------------

export async function markOrderPaid(
  name: string,
): Promise<{ name: string; payment_status: PaymentStatus; accounting_status?: string; status?: OrderStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("mark_order_paid"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ name }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تسجيل التحصيل."));
  return (await res.json()).message;
}

// --- Vendor commission -------------------------------------------------------

export async function setVendorCommission(
  name: string,
  commissionRate: number | null,
): Promise<{ name: string; commission_rate: number }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("set_vendor_commission"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ name, commission_rate: commissionRate ?? "" }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ العمولة."));
  return (await res.json()).message;
}

// --- Payment gateways & shipping providers -----------------------------------

export type PaymentConnector = {
  provider: "Cash on Delivery" | "Paymob" | "Fawry" | "Stripe";
  configured: boolean;
  enabled: boolean;
  mode?: "Test" | "Live" | null;
  public_key?: string | null;
  integration_id?: string | null;
  iframe_id?: string | null;
  has_api_key?: boolean;
  has_secret_key?: boolean;
  has_hmac_secret?: boolean;
};

export type ShippingProviderConfig = {
  provider: "Manual" | "Bosta" | "Aramex" | "Mylerz";
  configured: boolean;
  enabled: boolean;
  mode?: "Test" | "Live" | null;
  account_number?: string | null;
  base_url?: string | null;
  flat_rate?: number | null;
  free_over?: number | null;
  has_api_key?: boolean;
  has_api_secret?: boolean;
};

async function getListOp<T>(method: string): Promise<T[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(opUrl(method), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as T[];
  } catch (err) {
    reportApiFailure("operator", err);
    return [];
  }
}

async function postOp<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl(method), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ الإعدادات."));
  return (await res.json()).message;
}

export const listPaymentConnectors = () => getListOp<PaymentConnector>("list_payment_connectors");
export const updatePaymentConnector = (body: Record<string, unknown>) =>
  postOp<PaymentConnector>("update_payment_connector", body);
export const listShippingProviders = () =>
  getListOp<ShippingProviderConfig>("list_shipping_providers");
export const updateShippingProvider = (body: Record<string, unknown>) =>
  postOp<ShippingProviderConfig>("update_shipping_provider", body);

// -- store credit (wallet) ----------------------------------------------------

export type UserWallet = {
  user: string;
  /**
   * Whether an account with this email exists at all. A zero balance does not
   * say — a real customer who has never had store credit and a typo'd address
   * look identical without it.
   */
  exists?: boolean;
  balance: number;
  entries: WalletEntry[];
};

/** Operator: look up a user's store-credit balance + ledger by their login email. */
export async function getUserWallet(user: string): Promise<UserWallet | null> {
  if (!BASE || !user) return null;
  const qs = new URLSearchParams({ user });
  try {
    const res = await fetch(walletUrl("user_wallet", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as UserWallet | null;
  } catch (err) {
    reportApiFailure("operator", err);
    return null;
  }
}

/** Operator: credit or debit a user's store credit. */
export async function adjustWallet(
  user: string,
  amount: number,
  direction: "Credit" | "Debit",
  note?: string,
): Promise<{ balance: number; entry: string | null }> {
  const res = await fetch(walletUrl("adjust_wallet"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ user, amount, direction, note }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تعديل الرصيد."));
  return (await res.json()).message;
}

// --- Stock reconciliation ----------------------------------------------------

export type StockWarehouseRow = {
  warehouse: string;
  storefront: number;
  erpnext_available: number;
  erpnext_actual: number;
  reserved: number;
};

export type StockMismatch = {
  product: string;
  title: string;
  item: string;
  stock_qty: number;
  warehouses: StockWarehouseRow[];
  /** Set when a re-sync cannot clear this row (e.g. the ERPNext Item is disabled). */
  blocked?: string | null;
};

/** Products whose ERPNext quantity disagrees with what the shop offers.
 *  A healthy store returns an empty list. */
export async function stockHealth(): Promise<{ mismatches: StockMismatch[]; count: number }> {
  const empty = { mismatches: [], count: 0 };
  if (!BASE) return empty;
  try {
    const res = await fetch(opUrl("stock_health"), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("operator", `HTTP ${res.status}`);
      return empty;
    }
    return ((await res.json()).message ?? empty) as { mismatches: StockMismatch[]; count: number };
  } catch (err) {
    reportApiFailure("operator", err);
    return empty;
  }
}

/** Push the shop's quantities into ERPNext — one product, or everything drifted.
 *  Idempotent: posts nothing where the two already agree. */
export async function resyncStock(
  product?: string,
): Promise<{ product?: string; voucher?: string | null; remaining?: number }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("resync_stock"), {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(product ? { product } : {}),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّرت إعادة المزامنة."));
  return (await res.json()).message;
}

/** Put a product on the shelf, or take it off. Approval is a separate question. */
export async function setProductPublished(name: string, published: boolean) {
  const res = await fetch(opUrl("set_product_published"), {
    method: "POST",
    headers: writeHeaders(),
    credentials: "include",
    body: JSON.stringify({ name, published: published ? 1 : 0 }),
  });
  if (!res.ok) throw new Error("تعذّر تحديث حالة النشر.");
  return (await res.json()).message as { name: string; published: number };
}

/**
 * Take down every published product belonging to a hidden seller — the exact
 * thing `/admin/health` reports, in one call, so the finding has a button
 * instead of only advice.
 */
export async function unpublishHiddenVendorProducts() {
  const res = await fetch(opUrl("unpublish_hidden_vendor_products"), {
    method: "POST",
    headers: writeHeaders(),
    credentials: "include",
    body: "{}",
  });
  if (!res.ok) throw new Error("تعذّر إلغاء النشر.");
  return (await res.json()).message as { unpublished: number; failed: number };
}
