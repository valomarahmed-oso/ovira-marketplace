/** Returns — the buyer's half. Operator review and chargeback stay on the web. */

import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.returns";

export type ReturnStatus = "Requested" | "Approved" | "Rejected" | "Completed";

/** One line coming back. Priced from the order, never from the client. */
export type ReturnLine = {
  order_item: string;
  product?: string | null;
  title: string;
  qty: number;
  rate: number;
  amount: number;
};

/** What the buyer picks: which order line, and how many of it. */
export type ReturnSelection = { order_item: string; qty: number };

export type ReturnRequest = {
  name: string;
  order: string;
  status: ReturnStatus;
  reason?: string;
  details?: string;
  /** The operator's decision, in their words. Shown to the buyer as-is. */
  operator_note?: string;
  refund_amount?: number;
  refund_method?: string;
  refund_reference?: string;
  /**
   * Empty means the WHOLE order. That is the shape every return had before
   * partial returns existed and is still the common case — a client that
   * renders "returning: nothing" for an empty list has misread it.
   */
  items?: ReturnLine[];
  date?: string;
};

/**
 * The reasons the backend accepts. Sent verbatim — the doctype stores these
 * exact English values and a translated string would fail validation.
 */
export const RETURN_REASONS = [
  "Damaged",
  "Wrong item",
  "Not as described",
  "Changed mind",
  "Other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export async function myReturns(): Promise<ReturnRequest[]> {
  return (await get<ReturnRequest[]>(`${NS}.my_returns`)) ?? [];
}

/** The return on one order, if it has one. `null` is the normal answer. */
export async function orderReturn(order: string): Promise<ReturnRequest | null> {
  return get<ReturnRequest>(`${NS}.order_return`, { order });
}

/**
 * Open a return. `items` picks specific lines; omitting it returns everything.
 *
 * Only the line id and a quantity are sent. Prices come from the order
 * server-side — a client that could name its own `rate` could name any refund
 * it liked.
 */
export function requestReturn(
  order: string,
  reason: ReturnReason | string,
  details?: string,
  items?: ReturnSelection[],
): Promise<ReturnRequest> {
  return post(
    `${NS}.request_return`,
    { order, reason, details, items: items?.length ? JSON.stringify(items) : undefined },
    "تعذّر إرسال طلب الإرجاع.",
  );
}
