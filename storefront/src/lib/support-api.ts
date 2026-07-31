// Customer support tickets — the buyer ↔ store channel.
//
// Distinct from lib/messaging-api (buyer ↔ vendor, scoped to one order): this
// reaches the store itself, about payments, delivery, accounts or anything with
// no single vendor to address.

import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
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
  unread: number;
};

export type TicketMessage = {
  id: string;
  body: string;
  sender_role: "Customer" | "Support";
  sender_name: string;
  mine: boolean;
  date: string;
};

export type TicketThread = {
  role: "customer" | "support";
  ticket: Ticket;
  messages: TicketMessage[];
  can_close: boolean;
};

export const TICKET_CATEGORIES: TicketCategory[] = [
  "Order issue",
  "Payment",
  "Delivery",
  "Product",
  "Return",
  "Account",
  "Other",
];

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

async function get<T>(method: string, params?: Record<string, string>): Promise<T | null> {
  if (!BASE) return null;
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  try {
    const res = await fetch(`${BASE}/api/method/${NS}.${method}${qs}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("support-api", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as T;
  } catch (err) {
    reportApiFailure("support-api", err);
    return null;
  }
}

async function post<T>(method: string, body: unknown, fallback: string): Promise<T> {
  if (!BASE) throw new Error(fallback);
  const res = await fetch(`${BASE}/api/method/${NS}.${method}`, {
    method: "POST",
    headers: writeHeaders({ Accept: "application/json" }),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return ((await res.json()).message ?? null) as T;
}

export async function myTickets(): Promise<Ticket[]> {
  return (await get<Ticket[]>("my_tickets")) ?? [];
}

export function getTicket(name: string): Promise<TicketThread | null> {
  return get<TicketThread>("ticket", { name });
}

export function createTicket(input: {
  subject: string;
  body: string;
  category?: TicketCategory;
  order?: string;
}): Promise<{ name: string }> {
  return post("create_ticket", input, "تعذّر فتح التذكرة.");
}

export function replyToTicket(name: string, body: string): Promise<TicketMessage> {
  return post<TicketMessage>("reply", { name, body }, "تعذّر إرسال الرد.");
}

export function setTicketStatus(
  name: string,
  status: TicketStatus
): Promise<{ name: string; status: TicketStatus }> {
  return post("set_status", { name, status }, "تعذّر تحديث الحالة.");
}

export async function allTickets(
  status?: "open" | TicketStatus
): Promise<{ tickets: Ticket[]; open_count: number }> {
  const res = await get<{ tickets: Ticket[]; open_count: number }>(
    "all_tickets",
    status ? { status } : undefined
  );
  return res ?? { tickets: [], open_count: 0 };
}

export async function supportUnread(): Promise<number> {
  return (await get<number>("unread_total")) ?? 0;
}
