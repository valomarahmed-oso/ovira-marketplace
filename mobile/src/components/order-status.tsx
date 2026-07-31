import type { OrderStatus } from "@ovira/core";

import { Pill } from "./ui";

/**
 * An order's status, in the shopper's words and in a colour that means
 * something.
 *
 * The English `OrderStatus` values are what the backend stores; a customer
 * should never see "Pending Payment" on an Arabic screen. The mapping lives
 * here rather than in the dictionary because it is a translation of a *state
 * machine*, and an unmapped status must fall through as its raw value rather
 * than render blank — a new status the backend adds should look unfamiliar, not
 * invisible.
 */
const LABELS: Record<OrderStatus, string> = {
  "Pending Payment": "بانتظار الدفع",
  Paid: "مدفوع",
  Processing: "بيتجهّز",
  Shipped: "في الطريق",
  Completed: "تم التسليم",
  Cancelled: "ملغي",
};

const TONES: Record<OrderStatus, "blue" | "mint" | "coral"> = {
  "Pending Payment": "blue",
  Paid: "mint",
  Processing: "blue",
  Shipped: "blue",
  Completed: "mint",
  Cancelled: "coral",
};

export function statusLabel(status: string): string {
  return LABELS[status as OrderStatus] ?? status;
}

export function OrderStatusPill({ status }: { status: string }) {
  const tone = TONES[status as OrderStatus] ?? "blue";
  return <Pill label={statusLabel(status)} tone={tone} />;
}

/** Paid / unpaid, said plainly — it is the first thing a shopper looks for. */
export function PaymentPill({ status }: { status?: string }) {
  const paid = (status ?? "").toLowerCase() === "paid";
  return <Pill label={paid ? "مدفوع" : "غير مدفوع"} tone={paid ? "mint" : "coral"} />;
}
