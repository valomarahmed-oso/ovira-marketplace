import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.shipping";

export type ShipmentEvent = {
  status?: string;
  description?: string;
  location?: string;
  posted_at?: string | null;
};

export type Shipment = {
  name: string;
  vendor?: string;
  vendor_name?: string | null;
  status: string;
  provider?: string;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipping_cost?: number;
  events?: ShipmentEvent[];
};

// Statuses an operator/vendor can set manually (the terminal + in-flight ones).
export const SHIPMENT_STATUSES = [
  "Created",
  "Picked Up",
  "In Transit",
  "Delivered",
  "Returned",
  "Cancelled",
] as const;

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  Draft: "مسودة",
  Created: "تم الإنشاء",
  "Picked Up": "تم الاستلام",
  "In Transit": "في الطريق",
  Delivered: "تم التسليم",
  Returned: "مُرتجَع",
  Cancelled: "ملغى",
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

async function getShipments(method: string, order: string): Promise<Shipment[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.${method}?order=${encodeURIComponent(order)}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (((await res.json()).message ?? {}).shipments ?? []) as Shipment[];
  } catch {
    return [];
  }
}

async function post<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية، حاول مرة أخرى."));
  return (await res.json()).message as T;
}

/** Buyer: shipments for an order they own. */
export const getOrderTracking = (order: string) => getShipments("order_tracking", order);

/** Operator: shipments for any order. */
export const getOperatorOrderShipments = (order: string) =>
  getShipments("operator_order_shipments", order);

/** Operator: create one shipment per vendor sub-order. */
export const createOrderShipments = (order: string) =>
  post<{ shipments: string[] }>("create_shipments_for_order", { order });

/** Vendor: their own shipments for their sub-order of an order. */
export const getMyOrderShipments = (order: string) => getShipments("my_order_shipments", order);

/** Vendor: create the shipment for their sub-order (per-vendor fulfilment). */
export const createMyShipment = (order: string) =>
  post<{ shipments: string[] }>("create_my_shipment", { order });

/** Operator or owning vendor: advance a shipment + log an event. */
export const updateShipmentStatus = (shipment: string, status: string, note?: string) =>
  post<Shipment>("update_shipment_status", { shipment, status, note });

/** Operator: verify delivery with the buyer's one-time code → completes the order. */
export const confirmDelivery = (order: string, otp: string) =>
  post<{ confirmed: boolean; already?: boolean }>("confirm_delivery", { order, otp });

/** Operator: (re)issue + resend the delivery code to the buyer. */
export const resendDeliveryOtp = (order: string) =>
  post<{ sent: boolean }>("resend_delivery_otp", { order });

/** Vendor: map of { order: latest shipment status } for their shipments. */
export async function getVendorShipmentStatuses(): Promise<Record<string, string>> {
  if (!BASE) return {};
  try {
    const res = await fetch(`${BASE}/api/method/${M}.vendor_shipment_statuses`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return {};
    return ((await res.json()).message ?? {}) as Record<string, string>;
  } catch {
    return {};
  }
}
