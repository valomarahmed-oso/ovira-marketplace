// Operator client for cash-on-delivery risk screening.

import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const NS = "ovira_marketplace.api.cod_risk";

export type BlocklistEntry = {
  name: string;
  identifier: string;
  kind: "Phone" | "Email";
  active: number;
  reason?: string | null;
  orders_refused?: number;
  note?: string | null;
  creation?: string;
};

export type FlaggedOrder = {
  name: string;
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  governorate?: string | null;
  total: number;
  status: string;
  cod_risk_score: number;
  cod_risk_flags?: string | null;
  creation: string;
};

export type Assessment = {
  decision: "allow" | "review" | "block";
  score: number;
  reasons: string[];
  open_orders: number;
  refused: number;
  delivered: number;
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

async function get<T>(method: string, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/api/method/${NS}.${method}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    return ((await res.json()).message ?? fallback) as T;
  } catch {
    return fallback;
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

export const listBlocklist = () => get<BlocklistEntry[]>("list_blocklist", []);
export const flaggedOrders = () => get<FlaggedOrder[]>("flagged_orders", []);

export const upsertBlocklist = (input: {
  name?: string;
  identifier?: string;
  kind?: "Phone" | "Email";
  reason?: string;
  note?: string;
  active?: number;
  orders_refused?: number;
}) => post<BlocklistEntry[]>("upsert_blocklist", input, "تعذّر الحفظ.");

export const deleteBlocklist = (name: string) =>
  post<BlocklistEntry[]>("delete_blocklist", { name }, "تعذّر الحذف.");

export const clearFlag = (order: string) =>
  post<{ ok: boolean }>("clear_flag", { order }, "تعذّر تحرير الطلب.");

export const previewAssessment = (input: { phone?: string; email?: string; amount?: number }) =>
  post<Assessment>("preview_assessment", input, "تعذّر الفحص.");
