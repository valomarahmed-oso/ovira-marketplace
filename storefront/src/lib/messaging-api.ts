import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.messaging";

export type ChatMessage = {
  id: string;
  body: string;
  sender_role: "Buyer" | "Vendor" | "Operator";
  sender_name?: string;
  mine: boolean;
  date: string;
};

export type OrderVendor = {
  vendor: string;
  vendor_name: string;
  unread: number;
};

export type ChatThread = {
  role: "buyer" | "vendor" | "operator";
  vendor: string;
  vendor_name: string;
  messages: ChatMessage[];
};

export type VendorThread = {
  order: string;
  customer_name?: string | null;
  last_body: string;
  last_date: string;
  unread: number;
};

export type BuyerThread = {
  order: string;
  vendor: string;
  vendor_name: string;
  last_body: string;
  last_date: string;
  unread: number;
};

export type OperatorThread = {
  order: string;
  vendor: string;
  vendor_name: string;
  customer_name?: string | null;
  last_body: string;
  last_date: string;
  messages: number;
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

async function get<T>(method: string, params: Record<string, string>, fallback: T): Promise<T> {
  if (!BASE) return fallback;
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}/api/method/${M}.${method}?${qs}`, {
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

export const getOrderVendors = (order: string) =>
  get<OrderVendor[]>("order_vendors", { order }, []);

export const getThread = (order: string, vendor: string) =>
  get<ChatThread | null>("thread", { order, vendor }, null);

export const getVendorThreads = () => get<VendorThread[]>("vendor_threads", {}, []);

export const getBuyerThreads = () => get<BuyerThread[]>("buyer_threads", {}, []);

export const getAllThreads = () => get<OperatorThread[]>("all_threads", {}, []);

export const getUnreadTotal = () => get<number>("unread_total", {}, 0);

export async function postMessage(
  order: string,
  vendor: string,
  body: string,
): Promise<ChatMessage> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.post_message`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ order, vendor, body }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر إرسال الرسالة."));
  return (await res.json()).message as ChatMessage;
}
