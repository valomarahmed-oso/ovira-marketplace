/**
 * Support tickets — the buyer ↔ **store** channel.
 *
 * Distinct from `messaging.ts`, which is buyer ↔ **vendor** and scoped to one
 * order. This one reaches the operator, about payment, delivery, an account, or
 * anything with no single seller to address.
 */

import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.support";

export type TicketStatus =
  | "Open"
  | "Awaiting customer"
  | "Awaiting support"
  | "Resolved"
  | "Closed";

export type TicketCategory =
  | "Order issue"
  | "Payment"
  | "Delivery"
  | "Product"
  | "Return"
  | "Account"
  | "Other";

export type Ticket = {
  name: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: string;
  order?: string | null;
  customer_email: string;
  last_activity: string;
  created: string;
  /** Messages the other side sent that this side has not opened. */
  unread: number;
};

export type TicketMessage = {
  id: string;
  body: string;
  sender_role: "Customer" | "Support";
  sender_name: string;
  /** Whether *this* session wrote it — which side of the thread to draw it on. */
  mine: boolean;
  date: string;
};

export type TicketThread = {
  role: "customer" | "support";
  ticket: Ticket;
  messages: TicketMessage[];
  can_close: boolean;
};

/** Sent verbatim — the doctype stores these exact English values. */
export const TICKET_CATEGORIES: TicketCategory[] = [
  "Order issue",
  "Payment",
  "Delivery",
  "Product",
  "Return",
  "Account",
  "Other",
];

export async function myTickets(limit = 50): Promise<Ticket[]> {
  return (await get<Ticket[]>(`${NS}.my_tickets`, { limit })) ?? [];
}

/** One thread. Reading it marks the other side's messages as seen, server-side. */
export async function ticketThread(name: string): Promise<TicketThread | null> {
  return get<TicketThread>(`${NS}.ticket`, { name });
}

export function createTicket(input: {
  subject: string;
  body: string;
  category?: TicketCategory;
  order?: string;
}): Promise<Ticket> {
  return post(`${NS}.create_ticket`, input, "تعذّر إنشاء التذكرة.");
}

export function replyToTicket(name: string, body: string): Promise<TicketMessage> {
  return post(`${NS}.reply`, { name, body }, "تعذّر إرسال الرد.");
}

export function setTicketStatus(name: string, status: TicketStatus): Promise<Ticket> {
  return post(`${NS}.set_status`, { name, status }, "تعذّر تحديث حالة التذكرة.");
}

/** For a badge. Returns 0 rather than throwing for a guest. */
export async function supportUnreadTotal(): Promise<number> {
  const res = await get<{ unread: number } | number>(`${NS}.unread_total`);
  if (typeof res === "number") return res;
  return res?.unread ?? 0;
}
