import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.returns";

export type ReturnStatus = "Requested" | "Approved" | "Rejected" | "Completed";

/** Who funds the refund. "Vendor" charges it back to the seller; "Store" and
 *  "Goodwill" are absorbed by the operator. */
export type ReturnFault = "Vendor" | "Store" | "Goodwill";

export type ReturnRequest = {
  name: string;
  order: string;
  status: ReturnStatus;
  reason?: string;
  details?: string;
  operator_note?: string;
  refund_amount?: number;
  customer_email?: string;
  date?: string;
  fault?: ReturnFault;
  refund_method?: string;
  /** Filled in once the chargeback books. */
  vendor_charged?: number;
  commission_returned?: number;
  admin_fee?: number;
  chargeback_entry?: string;
  refund_reference?: string;
  /** Empty means the WHOLE order — the common case, not a missing selection. */
  items?: ReturnLine[];
};

/** What charging a return back to the vendor would cost them — computed, not booked. */
export type ChargebackPreview = {
  applies: boolean;
  reason?: "no_refund" | "disabled" | "not_vendor_fault" | "multi_vendor";
  vendor?: string;
  charged?: number;
  commission_returned?: number;
  admin_fee?: number;
  commission?: number;
};

export type RefundCapability = {
  supported: boolean;
  provider?: string;
  paid: boolean;
  has_reference: boolean;
  amount: number;
};

export const RETURN_REASONS = [
  "Damaged",
  "Wrong item",
  "Not as described",
  "Changed mind",
  "Other",
] as const;

export const RETURN_REASON_LABEL: Record<string, string> = {
  Damaged: "المنتج تالف",
  "Wrong item": "منتج خاطئ",
  "Not as described": "مختلف عن الوصف",
  "Changed mind": "غيّرت رأيي",
  Other: "سبب آخر",
};

export const RETURN_STATUS_LABEL: Record<string, string> = {
  Requested: "قيد المراجعة",
  Approved: "مقبول",
  Rejected: "مرفوض",
  Completed: "مكتمل",
};

export const RETURN_STATUS_STYLE: Record<string, string> = {
  Requested: "bg-[#fdf2dd] text-[#854f0b]",
  Approved: "bg-blue-50 text-blue-600",
  Rejected: "bg-coral-50 text-coral",
  Completed: "bg-[#e7f8f1] text-mint",
};

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

// `ns` overrides the default module — the refund endpoints live in api.payment,
// but belong to the returns UI, so they're exposed from this client.
async function get<T>(method: string, qs: string, fallback: T, ns: string = M): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/api/method/${ns}.${method}${qs}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const msg = (await res.json()).message;
    return (msg ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function post<T>(
  method: string,
  body: Record<string, unknown>,
  ns: string = M,
): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${ns}.${method}`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية، حاول مرة أخرى."));
  return (await res.json()).message as T;
}

// -- buyer ------------------------------------------------------------------

export const getOrderReturn = (order: string) =>
  get<ReturnRequest | null>("order_return", `?order=${encodeURIComponent(order)}`, null);

export const getMyReturns = () => get<ReturnRequest[]>("my_returns", "", []);

/** What the buyer picks: which order line, and how many of it. */
export type ReturnSelection = { order_item: string; qty: number };

/** One line coming back, priced from the order rather than from the client. */
export type ReturnLine = {
  order_item: string;
  product?: string | null;
  title: string;
  qty: number;
  rate: number;
  amount: number;
};

/**
 * Open a return. `items` picks specific lines; omitting it returns everything.
 *
 * Only the line id and a quantity go up — a client that could name its own
 * `rate` could name any refund it liked.
 */
export const requestReturn = (
  order: string,
  reason: string,
  details?: string,
  items?: ReturnSelection[],
) =>
  post<ReturnRequest>("request_return", {
    order,
    reason,
    details,
    items: items?.length ? JSON.stringify(items) : undefined,
  });

// -- operator ---------------------------------------------------------------

export const listReturns = (status?: string) =>
  get<ReturnRequest[]>("list_returns", status && status !== "All" ? `?status=${status}` : "", []);

export const setReturnStatus = (
  name: string,
  status: ReturnStatus,
  note?: string,
  refund_amount?: number,
  fault?: ReturnFault,
) => post<ReturnRequest>("set_return_status", { name, status, note, refund_amount, fault });

export const getChargebackPreview = (name: string) =>
  get<ChargebackPreview | null>("chargeback_preview", `?name=${encodeURIComponent(name)}`, null);

/** Can this order's payment go back to the original instrument? */
export const getRefundCapability = (order: string) =>
  get<RefundCapability | null>(
    "refund_capability",
    `?order_name=${encodeURIComponent(order)}`,
    null,
    "ovira_marketplace.api.payment",
  );

export const refundToSource = (return_name: string, amount?: number) =>
  post<{ ok: boolean; reference?: string; amount?: number; already?: boolean }>(
    "refund_to_source",
    { return_name, amount },
    "ovira_marketplace.api.payment",
  );
