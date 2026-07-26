import { writeHeaders } from "@/lib/frappe-client";
import type { SiteContent } from "@/lib/api";

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
  shipping_mode?: string;
  default_warehouse?: string | null;
  store_credit_account?: string | null;
  loyalty_enabled?: number;
  loyalty_earn_rate?: number;
  loyalty_redeem_value?: number;
  loyalty_min_redeem?: number;
  /** Charge a vendor-fault refund back to that vendor (Amazon model). */
  refund_charge_vendor?: number;
  /** Share of the original commission the operator keeps on a refund. */
  refund_admin_fee_percent?: number;
  /** Cap on that fee per return, in the base currency. 0 = uncapped. */
  refund_admin_fee_cap?: number;
  /** COD risk screening — inert until enabled. */
  cod_risk_enabled?: number;
  cod_max_open_orders?: number;
  cod_max_order_value?: number;
  cod_new_customer_max_value?: number;
  cod_max_refusal_rate?: number;
  /** Read-only: whether outgoing email is configured (drives the email hint). */
  email_configured?: boolean;
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

export type WhatsAppConfig = {
  enabled?: number;
  api_base?: string | null;
  phone_number_id?: string | null;
  default_country_code?: string | null;
  template_order_confirmation?: string | null;
  template_order_status?: string | null;
  template_return_update?: string | null;
  template_delivery_otp?: string | null;
  template_lang?: string | null;
  has_token?: boolean;
  configured?: boolean;
};

export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.get_whatsapp_config`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as WhatsAppConfig | null;
  } catch {
    return null;
  }
}

export async function updateWhatsAppConfig(data: Record<string, unknown>): Promise<WhatsAppConfig> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.update_whatsapp_config`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ إعدادات واتساب."));
  return (await res.json()).message;
}

export type EmailConfig = {
  configured: boolean;
  email_id?: string;
  smtp_server?: string;
  smtp_port?: number;
  use_tls?: number;
  use_ssl?: number;
  login_id?: string | null;
  has_password?: boolean;
};

export async function getEmailConfig(): Promise<EmailConfig | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.get_email_config`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as EmailConfig | null;
  } catch {
    return null;
  }
}

export async function updateEmailConfig(data: Record<string, unknown>): Promise<EmailConfig> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.update_email_config`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ إعدادات البريد."));
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

export async function getSiteContentAdmin(): Promise<SiteContent> {
  if (!BASE) return {};
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.cms.get_site_content`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return {};
    return ((await res.json()).message ?? {}) as SiteContent;
  } catch {
    return {};
  }
}

export async function updateSiteContent(data: Partial<SiteContent>): Promise<SiteContent> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.admin.update_site_content`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر حفظ المحتوى."));
  return (await res.json()).message;
}
