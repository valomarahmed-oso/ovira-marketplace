import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type AdminSettings = {
  mode: string;
  operator_company?: string;
  default_currency?: string;
  default_commission_rate?: number;
  auto_approve_vendors?: number;
  auto_approve_products?: number;
  sync_website_item?: number;
  deal_product?: string | null;
  sales_tax_template?: string | null;
  shipping_account?: string | null;
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

export async function getAdminSettings(): Promise<AdminSettings | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.get_admin_settings`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as AdminSettings | null;
  } catch {
    return null;
  }
}

export async function updateAdminSettings(data: Partial<AdminSettings>): Promise<AdminSettings> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.update_admin_settings`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ الإعدادات."));
  return (await res.json()).message;
}

export async function getProductOptions(): Promise<{ name: string; title: string }[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.product_options`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as { name: string; title: string }[];
  } catch {
    return [];
  }
}
