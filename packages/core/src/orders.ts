/** The buyer's own orders, and public tracking. */

import { fileUrl } from "./config.js";
import { get, post } from "./http.js";
import type { Order } from "./types.js";

const NS = "ovira_marketplace.api.orders";

export async function myOrders(): Promise<Order[]> {
  return (await get<Order[]>(`${NS}.my_orders`)) ?? [];
}

export async function getOrder(name: string): Promise<Order | null> {
  const order = await get<Order>(`${NS}.get_order`, { name });
  if (!order) return null;
  return {
    ...order,
    items: (order.items ?? []).map((it) => ({ ...it, image: fileUrl(it.image) })),
  };
}

/**
 * Public tracking. Works without a login: the order's own capability token
 * authorises exactly that order, so a guest can follow their delivery without
 * every order being readable by anyone who can guess an id.
 */
export async function trackOrder(params: {
  name?: string;
  token?: string;
  email?: string;
  phone?: string;
}): Promise<Order | null> {
  return get<Order>(`${NS}.track_order`, params);
}

export function cancelOrder(name: string): Promise<{ status: Order["status"] }> {
  return post(`${NS}.cancel_order`, { name }, "تعذّر إلغاء الطلب.");
}

/** Past-order items still buyable, for one-tap re-ordering. */
export async function reorderItems(name: string): Promise<Array<{ slug: string; qty: number }>> {
  try {
    return await post(`${NS}.reorder`, { name }, "تعذّر إعادة الطلب.");
  } catch {
    return [];
  }
}
