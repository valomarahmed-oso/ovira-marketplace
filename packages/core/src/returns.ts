/** Returns — the buyer's half. Operator review and chargeback stay on the web. */

import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.returns";

export type ReturnStatus = "Requested" | "Approved" | "Rejected" | "Completed";

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

export function requestReturn(
  order: string,
  reason: ReturnReason | string,
  details?: string,
): Promise<ReturnRequest> {
  return post(`${NS}.request_return`, { order, reason, details }, "تعذّر إرسال طلب الإرجاع.");
}
