/**
 * Buyer ↔ **vendor** messages, scoped to one order.
 *
 * Distinct from `support.ts`, which reaches the operator. A question about a
 * specific item belongs to the seller who shipped it; a question about a
 * payment does not, and sending the second down this channel means the person
 * who can answer it never sees it.
 */

import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.messaging";

export type MessageRole = "Buyer" | "Vendor" | "Operator";

export type Message = {
  id: string;
  body: string;
  sender_role: MessageRole;
  sender_name: string;
  /** Whether this session wrote it — which side of the thread to draw it on. */
  mine: boolean;
  date: string;
};

/** One conversation in a list: an (order, vendor) pair, with its last line. */
export type ThreadSummary = {
  order: string;
  vendor: string;
  vendor_name?: string | null;
  last_body: string;
  last_date: string;
  unread: number;
  /** Present on the vendor's list — who is asking. */
  buyer_name?: string | null;
};

/** The sellers a buyer can write to about a given order. */
export async function orderVendors(
  order: string,
): Promise<Array<{ vendor: string; vendor_name?: string | null }>> {
  return (await get<Array<{ vendor: string; vendor_name?: string | null }>>(
    `${NS}.order_vendors`,
    { order },
  )) ?? [];
}

/** Reading a thread marks the other side's messages as seen, server-side. */
export async function messageThread(
  order: string,
  vendor: string,
  limit = 200,
): Promise<Message[]> {
  return (await get<Message[]>(`${NS}.thread`, { order, vendor, limit })) ?? [];
}

export function postMessage(order: string, vendor: string, body: string): Promise<Message> {
  return post(`${NS}.post_message`, { order, vendor, body }, "تعذّر إرسال الرسالة.");
}

export async function buyerThreads(limit = 100): Promise<ThreadSummary[]> {
  return (await get<ThreadSummary[]>(`${NS}.buyer_threads`, { limit })) ?? [];
}

export async function vendorThreads(limit = 100): Promise<ThreadSummary[]> {
  return (await get<ThreadSummary[]>(`${NS}.vendor_threads`, { limit })) ?? [];
}

/** For a badge. 0 rather than a throw when signed out. */
export async function messagesUnreadTotal(): Promise<number> {
  const res = await get<{ unread: number } | number>(`${NS}.unread_total`);
  if (typeof res === "number") return res;
  return res?.unread ?? 0;
}
