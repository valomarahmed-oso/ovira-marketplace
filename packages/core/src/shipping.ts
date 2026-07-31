/** Delivery: what it costs, how fast, and who carries it. */

import { get } from "./http.js";
import type { CartLine } from "./types.js";

const NS = "ovira_marketplace.api.shipping";

/**
 * Egypt's governorates, as this store offers them.
 *
 * Copied from `storefront/src/lib/addresses-api.ts` so both clients present the
 * same list. It is short on purpose — the operator has rates for the ones they
 * actually deliver to, and "أخرى" is the honest catch-all rather than a
 * twenty-seven-item picker where most entries would fail at checkout.
 */
export const GOVERNORATES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "الدقهلية",
  "الشرقية",
  "القليوبية",
  "أخرى",
] as const;

export type ShippingMethod = {
  name: string;
  method_name: string;
  method_name_en?: string | null;
  surcharge: number;
  eta_min_days: number;
  eta_max_days: number;
  description?: string | null;
  is_default?: 0 | 1;
};

export type ShippingQuote = {
  base: number;
  surcharge: number;
  total: number;
  method?: string | null;
  method_name?: string | null;
  eta_min_days: number;
  eta_max_days: number;
};

export type Carrier = { carrier_name: string; carrier_name_en?: string | null; logo?: string | null };

export async function listShippingMethods(): Promise<ShippingMethod[]> {
  return (await get<ShippingMethod[]>(`${NS}.list_shipping_methods`)) ?? [];
}

/**
 * The full delivery quote: base cost, the chosen method's surcharge, and the
 * promised window.
 *
 * Always asked of the server, never derived here. This store prices shipping
 * two entirely different ways depending on a setting — one operator rate table,
 * or each vendor's own rules summed per seller — and a client that tried to
 * reproduce either would be wrong the first time the operator changed mode.
 */
export async function shippingQuote(
  lines: CartLine[],
  governorate?: string,
  method?: string,
): Promise<ShippingQuote | null> {
  return get<ShippingQuote>(`${NS}.quote`, {
    items: JSON.stringify(lines.map((l) => ({ slug: l.slug, qty: l.qty }))),
    governorate,
    method,
  });
}

/** Couriers the shopper may state a preference for. A request, not an instruction. */
export async function listCarriers(): Promise<Carrier[]> {
  return (await get<Carrier[]>(`${NS}.carrier_options`)) ?? [];
}

export type ShipmentEvent = {
  status: string;
  note?: string | null;
  location?: string | null;
  event_time?: string | null;
};

export type Shipment = {
  name: string;
  status: string;
  carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  events?: ShipmentEvent[];
};

export async function orderTracking(order: string): Promise<Shipment[]> {
  return (await get<Shipment[]>(`${NS}.order_tracking`, { order })) ?? [];
}
