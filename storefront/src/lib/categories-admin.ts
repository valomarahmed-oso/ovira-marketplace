import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.categories";

export type AdminCategory = {
  name: string;
  category_name: string;
  slug: string;
  parent_marketplace_category?: string | null;
  is_group?: number;
  icon?: string | null;
  image?: string | null;
  display_order?: number | null;
  description?: string | null;
  product_count: number;
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

export async function listAllCategories(): Promise<AdminCategory[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_all_categories`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as AdminCategory[];
  } catch {
    return [];
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
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ القسم."));
  return (await res.json()).message as T;
}

export const upsertCategory = (body: Record<string, unknown>) =>
  post<{ name: string; slug: string }>("upsert_category", body);

export const deleteCategory = (name: string) =>
  post<{ deleted: string }>("delete_category", { name });
