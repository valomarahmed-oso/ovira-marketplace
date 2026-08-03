/** A seller's shipments and their waybills. */

import { get, post } from "./http.js";
import type { Shipment } from "./shipping.js";

const NS = "ovira_marketplace.api.shipping";

/**
 * Couriers for the **seller's** picker.
 *
 * Not `carrier_options`, which is the shopper's list and is deliberately
 * narrower: a buyer stating a preference has no use for a tracking-URL
 * template, and that template is exactly what turns a tracking number the
 * seller types into a link the buyer can open.
 */
export async function listVendorCarriers(): Promise<
  Array<{ carrier_name: string; carrier_name_en?: string | null; tracking_url_template?: string | null }>
> {
  return (
    (await get<
      Array<{
        carrier_name: string;
        carrier_name_en?: string | null;
        tracking_url_template?: string | null;
      }>
    >(`${NS}.list_carriers`)) ?? []
  );
}

/** What a vendor or operator may set by hand — the in-flight and terminal ones. */
export const SHIPMENT_STATUSES = [
  "Created",
  "Picked Up",
  "In Transit",
  "Delivered",
  "Returned",
  "Cancelled",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/**
 * The seller's shipments on one order, plus whatever courier the buyer asked
 * for. The preference is a request, not an instruction — the vendor books the
 * shipment — so it is returned alongside rather than pre-filled as fact.
 */
export async function myOrderShipments(
  order: string,
): Promise<{ shipments: Shipment[]; preferred_carrier: string | null }> {
  return (
    (await get<{ shipments: Shipment[]; preferred_carrier: string | null }>(
      `${NS}.my_order_shipments`,
      { order },
    )) ?? { shipments: [], preferred_carrier: null }
  );
}

export function createMyShipment(
  order: string,
  details?: { carrier?: string; tracking_number?: string; tracking_url?: string },
): Promise<{ shipments: string[] }> {
  return post(`${NS}.create_my_shipment`, { order, ...details }, "تعذّر تسجيل الشحنة.");
}

/** Edit courier/tracking and/or advance the status — one call, as the web does. */
export function updateMyShipment(
  shipment: string,
  patch: {
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    status?: ShipmentStatus;
  },
): Promise<Shipment> {
  return post(`${NS}.update_my_shipment`, { shipment, ...patch }, "تعذّر تحديث الشحنة.");
}

/** Everything a waybill has to carry. */
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
  items: Array<{ title: string; qty: number }>;
  /** Whether the courier collects on delivery, and how much. */
  cod: boolean;
  cod_amount: number;
  currency: string;
};

export async function shipmentLabel(shipment: string): Promise<ShipmentLabel | null> {
  return get<ShipmentLabel>(`${NS}.shipment_label`, { shipment });
}
