import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.admin";

export type AdminBanner = {
  name: string;
  title: string;
  title_en?: string | null;
  subtitle?: string | null;
  subtitle_en?: string | null;
  placement: string;
  is_active: number;
  image?: string | null;
  link?: string | null;
  cta_label?: string | null;
  cta_label_en?: string | null;
  tone?: string | null;
  display_order?: number | null;
  valid_from?: string | null;
  valid_upto?: string | null;
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

export async function listBanners(): Promise<AdminBanner[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_banners`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("banners-admin", `HTTP ${res.status}`);
      return [];
    }
    return ((await res.json()).message ?? []) as AdminBanner[];
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
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ البانر."));
  return (await res.json()).message as T;
}

export const upsertBanner = (body: Record<string, unknown>) =>
  post<{ name: string }>("upsert_banner", body);

export const deleteBanner = (name: string) => post<{ ok: boolean }>("delete_banner", { name });
