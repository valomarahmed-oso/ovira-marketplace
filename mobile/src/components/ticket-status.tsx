import type { TicketCategory, TicketStatus } from "@ovira/core";

import { Pill } from "./ui";

/**
 * Ticket state and category in Arabic.
 *
 * Same rule as the order and return maps: the backend owns these values, they
 * are stored in English, and anything unmapped falls through as its raw value
 * so a state added later looks unfamiliar rather than invisible.
 */
const STATUS: Record<TicketStatus, string> = {
  Open: "مفتوحة",
  "Awaiting customer": "بانتظار ردّك",
  "Awaiting support": "بانتظار الدعم",
  Resolved: "تم الحل",
  Closed: "مقفولة",
};

const TONES: Record<TicketStatus, "blue" | "mint" | "coral"> = {
  Open: "blue",
  // The one the customer has to act on — the only status that is about them.
  "Awaiting customer": "coral",
  "Awaiting support": "blue",
  Resolved: "mint",
  Closed: "mint",
};

const CATEGORIES: Record<TicketCategory, string> = {
  "Order issue": "مشكلة في طلب",
  Payment: "الدفع",
  Delivery: "التوصيل",
  Product: "المنتج",
  Return: "الإرجاع",
  Account: "الحساب",
  Other: "أخرى",
};

export function ticketStatusLabel(status: string): string {
  return STATUS[status as TicketStatus] ?? status;
}

export function ticketCategoryLabel(category: string): string {
  return CATEGORIES[category as TicketCategory] ?? category;
}

export function TicketStatusPill({ status }: { status: string }) {
  return <Pill label={ticketStatusLabel(status)} tone={TONES[status as TicketStatus] ?? "blue"} />;
}
