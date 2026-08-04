import { writeHeaders } from "@/lib/frappe-client";
import type { Dict } from "@/lib/i18n";
import { reportApiFailure } from "@/lib/api-errors";

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
  carrier?: string | null;
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

/** Locale-aware shipment status label — bilingual, driven by the active dict.
 * Prefer this over the Arabic-only SHIPMENT_STATUS_LABEL in UI components. */
export function shipmentStatusLabel(t: Dict, status: string): string {
  const map: Record<string, string> = {
    Draft: t.sstDraft,
    Created: t.sstCreated,
    "Picked Up": t.sstPickedUp,
    "In Transit": t.sstInTransit,
    Delivered: t.sstDelivered,
    Returned: t.sstReturned,
    Cancelled: t.sstCancelled,
  };
  return map[status] ?? status;
}

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
    if (!res.ok) {
      reportApiFailure("shipments-api", `HTTP ${res.status}`);
      return [];
    }
    return (((await res.json()).message ?? {}).shipments ?? []) as Shipment[];
  } catch (err) {
    reportApiFailure("shipments-api", err);
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

/** Vendor: their own shipments for their sub-order of an order, plus the
 *  courier the buyer asked for (null when they didn't ask). */
export async function getMyOrderShipments(
  order: string,
): Promise<{ shipments: Shipment[]; preferred_carrier: string | null }> {
  const empty = { shipments: [], preferred_carrier: null };
  if (!BASE) return empty;
  try {
    const res = await fetch(
      `${BASE}/api/method/${M}.my_order_shipments?order=${encodeURIComponent(order)}`,
      { headers: { Accept: "application/json" }, credentials: "include", cache: "no-store" },
    );
    if (!res.ok) return empty;
    const msg = (await res.json()).message ?? {};
    return { shipments: (msg.shipments ?? []) as Shipment[], preferred_carrier: msg.preferred_carrier ?? null };
  } catch {
    return empty;
  }
}

/** Vendor: create the shipment for their sub-order (per-vendor fulfilment).
 * Optionally records the courier company + tracking the vendor chose. */
export const createMyShipment = (
  order: string,
  details?: { carrier?: string; tracking_number?: string; tracking_url?: string },
) => post<{ shipments: string[] }>("create_my_shipment", { order, ...details });

/** Operator or owning vendor: advance a shipment + log an event. */
export const updateShipmentStatus = (shipment: string, status: string, note?: string) =>
  post<Shipment>("update_shipment_status", { shipment, status, note });

/** Vendor (or operator): edit their shipment's courier + tracking, and/or
 * advance its status — the marketplace-neutral fulfilment update. */
export const updateMyShipment = (
  shipment: string,
  patch: { carrier?: string; tracking_number?: string; tracking_url?: string; status?: string },
) => post<Shipment>("update_my_shipment", { shipment, ...patch });

/**
 * Close an order handed over without a recorded shipment.
 *
 * The seller who drove the parcel over is the person who knows it arrived, and
 * until this existed such an order sat in Processing forever — "being prepared"
 * to a buyer already holding it. Open to the operator or to a vendor with a
 * line on the order; the server enforces which.
 */
export const markDelivered = (order: string, note?: string) =>
  post<{ status: string; already?: boolean }>("mark_delivered", { order, note });

/** Operator: verify delivery with the buyer's one-time code → completes the order. */
export const confirmDelivery = (order: string, otp: string) =>
  post<{ confirmed: boolean; already?: boolean }>("confirm_delivery", { order, otp });

/** Operator: (re)issue + resend the delivery code to the buyer. */
export const resendDeliveryOtp = (order: string) =>
  post<{ sent: boolean }>("resend_delivery_otp", { order });

export type Carrier = {
  carrier_name: string;
  carrier_name_en?: string | null;
  logo?: string | null;
  tracking_url_template?: string | null;
};

/** Public: courier companies a shopper can ask for at checkout. Narrower than
 *  `listCarriers` — no tracking template, no support line. */
export async function getCarrierOptions(): Promise<Carrier[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.carrier_options`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("shipments-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Carrier[];
  } catch (err) {
    reportApiFailure("shipments-api", err);
    return [];
  }
}

/** Enabled carriers for the vendor's shipment picker. */
export async function listCarriers(): Promise<Carrier[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_carriers`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("shipments-api", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as Carrier[];
  } catch (err) {
    reportApiFailure("shipments-api", err);
    return [];
  }
}

export type ShipmentLabel = {
  shipment: string;
  carrier?: string | null;
  provider?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  status: string;
  order?: string | null;
  vendor_name?: string | null;
  vendor_phone?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  governorate?: string | null;
  address?: string | null;
  items: { title: string; qty: number }[];
  cod: boolean;
  cod_amount: number;
  currency: string;
};

/** Printable waybill data for a shipment (owning vendor or operator). */
export async function getShipmentLabel(shipment: string): Promise<ShipmentLabel | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(
      `${BASE}/api/method/${M}.shipment_label?shipment=${encodeURIComponent(shipment)}`,
      { headers: { Accept: "application/json" }, credentials: "include", cache: "no-store" },
    );
    if (!res.ok) {
      reportApiFailure("shipments-api", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as ShipmentLabel | null;
  } catch (err) {
    reportApiFailure("shipments-api", err);
    return null;
  }
}

// -- operator: carrier directory CRUD ---------------------------------------

export type CarrierAdmin = Carrier & {
  name: string;
  phone?: string | null;
  display_order?: number;
  enabled?: number;
};

export const listCarriersAdmin = () =>
  getJson<CarrierAdmin[]>("list_carriers_admin", []);

export const upsertCarrier = (c: Partial<CarrierAdmin>) =>
  post<CarrierAdmin>("upsert_carrier", c as Record<string, unknown>);

export const deleteCarrier = (name: string) =>
  post<{ deleted: string }>("delete_carrier", { name });

async function getJson<T>(method: string, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    return ((await res.json()).message ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Vendor: map of { order: latest shipment status } for their shipments. */
export async function getVendorShipmentStatuses(): Promise<Record<string, string>> {
  if (!BASE) return {};
  try {
    const res = await fetch(`${BASE}/api/method/${M}.vendor_shipment_statuses`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("shipments-api", `HTTP ${res.status}`);
      return {};
    }
    return ((await res.json()).message ?? {}) as Record<string, string>;
  } catch (err) {
    reportApiFailure("shipments-api", err);
    return {};
  }
}
