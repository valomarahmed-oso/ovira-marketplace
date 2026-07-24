import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.payment";

export type PaymentMethodKind = "Cash on Delivery" | "Manual Transfer";

export type PaymentMethod = {
  name: string;
  method_name: string;
  method_name_en?: string | null;
  kind: PaymentMethodKind;
  instructions?: string | null;
  instructions_en?: string | null;
  account_details?: string | null;
  icon?: string | null;
};

export type PaymentMethodAdmin = PaymentMethod & {
  display_order?: number;
  enabled?: number;
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

async function getJson<T>(method: string, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
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

async function post<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message as T;
}

/** Public: enabled manual payment methods for the checkout. */
export const listPaymentMethods = () => getJson<PaymentMethod[]>("list_payment_methods", []);

/** Operator: every manual payment method (enabled or not). */
export const listPaymentMethodsAdmin = () =>
  getJson<PaymentMethodAdmin[]>("list_payment_methods_admin", []);

export const upsertPaymentMethod = (m: Partial<PaymentMethodAdmin>) =>
  post<PaymentMethodAdmin>("upsert_payment_method", m as Record<string, unknown>);

export const deletePaymentMethod = (name: string) =>
  post<{ deleted: string }>("delete_payment_method", { name });
