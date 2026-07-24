import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

/** Snapshot the shopper's cart for recovery. Best-effort; needs an email
 * (a signed-in user, or one passed in). A cleared cart removes the snapshot. */
export async function saveAbandonedCart(input: {
  items: { slug: string; qty: number; variant?: string }[];
  email?: string;
  customer_name?: string;
  phone?: string;
  subtotal?: number;
  currency?: string;
}): Promise<void> {
  if (!BASE) return;
  try {
    await fetch(`${BASE}/api/method/ovira_marketplace.api.abandoned_cart.save_cart`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(input),
      credentials: "include",
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}
