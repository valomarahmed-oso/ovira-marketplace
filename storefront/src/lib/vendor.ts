const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type VendorStore = {
  name: string;
  vendor_name: string;
  slug?: string;
  status: "Draft" | "Pending" | "Active" | "Suspended";
};

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

/** The current user's vendor store, or null if they don't have one. */
export async function getMyStore(): Promise<VendorStore | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.vendor.my_store`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as VendorStore | null;
  } catch {
    return null;
  }
}

/** POST a JSON body to a whitelisted method with the session cookie. */
async function postMethod<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية، حاول مرة أخرى."));
  return (await res.json()).message as T;
}

/** GET a whitelisted method (fresh, session-scoped). Returns [] on failure. */
async function getList<T>(method: string): Promise<T[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${method}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as T[];
  } catch {
    return [];
  }
}

export type VendorApprovalStatus = "Draft" | "Pending" | "Approved" | "Rejected";

export type VendorProduct = {
  name: string;
  title: string;
  slug?: string;
  price: number;
  compare_at_price?: number;
  currency?: string;
  stock_qty: number;
  approval_status: VendorApprovalStatus;
  category?: string;
  category_name?: string;
  condition?: "New" | "Used" | "Refurbished";
  image?: string;
};

export type ProductInput = {
  name?: string;
  title: string;
  price: number;
  category?: string;
  compare_at_price?: number;
  condition?: string;
  stock_qty?: number;
  image?: string;
  description?: string;
};

export type VendorOrder = {
  name: string;
  customer_name?: string;
  status: string;
  currency?: string;
  creation: string;
  item_count: number;
  vendor_total: number;
};

export const APPROVAL_LABEL: Record<VendorApprovalStatus, string> = {
  Draft: "مسودة",
  Pending: "بانتظار المراجعة",
  Approved: "معتمد",
  Rejected: "مرفوض",
};

export const APPROVAL_STYLE: Record<VendorApprovalStatus, string> = {
  Draft: "bg-[#f1efe8] text-ink-600",
  Pending: "bg-[#fdf2dd] text-[#854f0b]",
  Approved: "bg-[#e7f8f1] text-mint",
  Rejected: "bg-coral-50 text-coral",
};

export function getMyProducts() {
  return getList<VendorProduct>("ovira_marketplace.api.products.my_products");
}

export function upsertProduct(input: ProductInput) {
  return postMethod<{ name: string; approval_status: VendorApprovalStatus }>(
    "ovira_marketplace.api.products.upsert_product",
    input as Record<string, unknown>,
  );
}

export function deleteProduct(name: string) {
  return postMethod<{ deleted: string }>(
    "ovira_marketplace.api.products.delete_product",
    { name },
  );
}

export function getMyOrders() {
  return getList<VendorOrder>("ovira_marketplace.api.vendor.my_orders");
}

export function updateMyStore(data: Partial<Record<string, string>>) {
  return postMethod<VendorStore>("ovira_marketplace.api.vendor.update_my_store", data);
}

export type VendorApplication = {
  vendor_name: string;
  phone?: string;
  description?: string;
};

export async function registerVendor(
  data: VendorApplication,
): Promise<{ name: string; slug?: string; status: string }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.vendor.register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر إرسال الطلب، حاول مرة أخرى."));
  return (await res.json()).message;
}
