import { writeHeaders } from "@/lib/frappe-client";

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
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as Vendor[];
  } catch {
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
    if (!res.ok) return {};
    return ((await res.json()).message ?? {}) as VendorCounts;
  } catch {
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
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as AdminProduct[];
  } catch {
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
    if (!res.ok) return {};
    return ((await res.json()).message ?? {}) as VendorCounts;
  } catch {
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
  creation?: string;
  item_count?: number;
};

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
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as AdminOrder[];
  } catch {
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
    if (!res.ok) return {};
    return ((await res.json()).message ?? {}) as VendorCounts;
  } catch {
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
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as AdminOrderDetail | null;
  } catch {
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
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as VendorPayout[];
  } catch {
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
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as FailedAccountingOrder[];
  } catch {
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
