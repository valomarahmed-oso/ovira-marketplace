import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type BuyerAddress = {
  name: string;
  full_name: string;
  phone?: string;
  governorate: string;
  address: string;
  is_default: boolean;
};

export type AddressInput = {
  name?: string;
  full_name: string;
  address: string;
  governorate: string;
  phone?: string;
  is_default?: number;
};

export const GOVERNORATES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "الدقهلية",
  "الشرقية",
  "القليوبية",
  "أخرى",
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

async function post<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${method}`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية، حاول مرة أخرى."));
  return (await res.json()).message as T;
}

export async function getMyAddresses(): Promise<BuyerAddress[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.addresses.my_addresses`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as BuyerAddress[];
  } catch {
    return [];
  }
}

export function upsertAddress(input: AddressInput) {
  return post<BuyerAddress>("ovira_marketplace.api.addresses.upsert_address", input as Record<string, unknown>);
}

export function deleteAddress(name: string) {
  return post<{ deleted: string }>("ovira_marketplace.api.addresses.delete_address", { name });
}

export function setDefaultAddress(name: string) {
  return post<{ ok: boolean }>("ovira_marketplace.api.addresses.set_default_address", { name });
}
