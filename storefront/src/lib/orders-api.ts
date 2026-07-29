import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type BuyerOrderStatus =
  | "Pending Payment"
  | "Paid"
  | "Processing"
  | "Shipped"
  | "Completed"
  | "Cancelled";

export type BuyerOrderSummary = {
  name: string;
  status: BuyerOrderStatus;
  payment_status: string;
  payment_method?: string;
  currency?: string;
  subtotal: number;
  shipping_amount: number;
  total: number;
  creation: string;
  item_count: number;
};

export type BuyerOrderItem = {
  marketplace_product?: string;
  title: string;
  vendor?: string;
  qty: number;
  rate: number;
  amount: number;
  image?: string;
};

export type BuyerOrder = Omit<BuyerOrderSummary, "item_count"> & {
  customer_name?: string;
  phone?: string;
  email?: string;
  governorate?: string;
  shipping_address?: string;
  discount_amount?: number;
  coupon_code?: string;
  /** Delivery option picked at checkout, and the window promised at the time. */
  shipping_method?: string | null;
  shipping_eta_min?: number;
  shipping_eta_max?: number;
  preferred_carrier?: string | null;
  items: BuyerOrderItem[];
  /** Most significant return status on the order; "Completed" = sale reversed. */
  return_status?: string | null;
};

export const ORDER_STATUS_LABEL: Record<BuyerOrderStatus, string> = {
  "Pending Payment": "بانتظار الدفع",
  Paid: "مدفوع",
  Processing: "قيد التجهيز",
  Shipped: "تم الشحن",
  Completed: "مكتمل",
  Cancelled: "ملغي",
};

export const ORDER_STATUS_STYLE: Record<BuyerOrderStatus, string> = {
  "Pending Payment": "bg-[#f1efe8] text-ink-600",
  Paid: "bg-blue-50 text-blue-600",
  Processing: "bg-[#fdf2dd] text-[#854f0b]",
  Shipped: "bg-[#fdf2dd] text-[#854f0b]",
  Completed: "bg-[#e7f8f1] text-mint",
  Cancelled: "bg-coral-50 text-coral",
};

/** Steps shown in the buyer's order tracker, in order. */
export const ORDER_STEPS: { key: BuyerOrderStatus; label: string }[] = [
  { key: "Paid", label: "مدفوع" },
  { key: "Processing", label: "قيد التجهيز" },
  { key: "Shipped", label: "تم الشحن" },
  { key: "Completed", label: "تم التسليم" },
];

export async function getMyOrders(): Promise<BuyerOrderSummary[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.orders.my_orders`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as BuyerOrderSummary[];
  } catch {
    return [];
  }
}

export async function getOrder(name: string): Promise<BuyerOrder | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(
      `${BASE}/api/method/ovira_marketplace.api.orders.get_order?name=${encodeURIComponent(name)}`,
      { headers: { Accept: "application/json" }, credentials: "include", cache: "no-store" },
    );
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as BuyerOrder | null;
  } catch {
    return null;
  }
}

/** Past-order items still buyable, as {slug, qty}, for re-adding to the cart. */
export async function reorderItems(name: string): Promise<{ slug: string; qty: number }[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.orders.reorder`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ name }),
      credentials: "include",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as { slug: string; qty: number }[];
  } catch {
    return [];
  }
}

/** Cancel an unshipped, unpaid order. Throws with the backend reason on refusal. */
export async function cancelOrder(name: string): Promise<{ status: BuyerOrderStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.orders.cancel_order`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ name }),
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "تعذّر إلغاء الطلب.";
    try {
      const data = await res.json();
      const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
      if (raw) msg = JSON.parse(raw).message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()).message;
}
