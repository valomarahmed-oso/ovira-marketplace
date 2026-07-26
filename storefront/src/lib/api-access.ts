// Operator client for API access keys.
//
// A secret is returned exactly once, at creation or rotation. It is stored
// encrypted server-side and is never readable again — so the screen must show
// it immediately and offer rotation, not recovery.

import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const NS = "ovira_marketplace.api.api_access";

export type ApiScope = "Read Only" | "Content Editor" | "Operator";

export type ApiKeyRow = {
  name: string;
  label: string;
  scope: ApiScope;
  enabled: number;
  user: string;
  key_prefix: string;
  note?: string | null;
  created?: string | null;
  revoked_on?: string | null;
  last_used?: string | null;
};

export type NewKey = { api_key: string; api_secret: string };

export type ApiExample = { label: string; method: string; auth: boolean };

export type ApiOverview = {
  base_url: string;
  method_url: string;
  auth_header: string;
  guest_note: string;
  examples: ApiExample[];
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

async function get<T>(method: string): Promise<T | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/${NS}.${method}`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as T;
  } catch {
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

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  return (await get<ApiKeyRow[]>("list_keys")) ?? [];
}

export function getApiOverview(): Promise<ApiOverview | null> {
  return get<ApiOverview>("api_overview");
}

export function createApiKey(input: {
  label: string;
  scope: ApiScope;
  note?: string;
}): Promise<{ created: ApiKeyRow } & NewKey> {
  return post("create_key", input, "تعذّر إنشاء المفتاح.");
}

export function revokeApiKey(name: string): Promise<ApiKeyRow[]> {
  return post<ApiKeyRow[]>("revoke_key", { name }, "تعذّر إلغاء المفتاح.");
}

export function rotateApiKey(name: string): Promise<NewKey> {
  return post<NewKey>("rotate_key", { name }, "تعذّر تجديد المفتاح.");
}

export function deleteApiKey(name: string): Promise<ApiKeyRow[]> {
  return post<ApiKeyRow[]>("delete_key", { name }, "تعذّر حذف المفتاح.");
}
