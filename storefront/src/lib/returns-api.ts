import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.returns";

export type ReturnStatus = "Requested" | "Approved" | "Rejected" | "Completed";

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

async function get<T>(method: string, qs: string, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/api/method/${M}.${method}${qs}`, {
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

async function post<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
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

export const requestReturn = (order: string, reason: string, details?: string) =>
  post<ReturnRequest>("request_return", { order, reason, details });

// -- operator ---------------------------------------------------------------

export const listReturns = (status?: string) =>
  get<ReturnRequest[]>("list_returns", status && status !== "All" ? `?status=${status}` : "", []);

export const setReturnStatus = (
  name: string,
  status: ReturnStatus,
  note?: string,
  refund_amount?: number,
) => post<ReturnRequest>("set_return_status", { name, status, note, refund_amount });
