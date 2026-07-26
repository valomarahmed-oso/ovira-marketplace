// Operator client for the Ovira Messaging Hub (`ovira_messaging`).
//
// The hub holds every credential; this client only ever sees non-secret data.
// A stored credential comes back as `has_secret: true` and nothing more, and
// secret-looking config values arrive already masked by the server — so a token
// can be replaced from here, but never read.

import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const NS = "ovira_marketplace.api.messaging_hub";

/** The placeholder the server substitutes for any secret-looking value. */
export const SECRET_MASK = "••••••••";

export type HubChannel = {
  id: string;
  label: string;
  family: string;
  needs: string[];
  supports_attachments: boolean;
};

export type HubStatus = {
  installed: boolean;
  channels: HubChannel[];
  senders: number;
  enabled_senders: number;
  live_families?: string[];
  app?: string;
  enable_logging?: number;
  fallback_family_order?: string;
  has_api_key?: boolean;
};

export type HubSender = {
  name: string;
  sender_name: string;
  channel: string;
  channel_label: string;
  family?: string;
  supports_attachments: boolean;
  needs: string[];
  enabled: number;
  is_default: number;
  company?: string | null;
  app_source?: string | null;
  priority: number;
  config: Record<string, unknown>;
  masked_config_keys: string[];
  /** True when a credential is stored. The value itself is never sent. */
  has_secret: boolean;
  can_probe: boolean;
};

export type WahaSession = {
  session: string | null;
  status: string | null;
  connected: boolean;
  number: string | null;
  display_name: string | null;
};

export type ProbeResult = {
  ok: boolean;
  channel?: string;
  summary?: string;
  error?: string;
  unsupported?: boolean;
  sessions?: WahaSession[];
  bot?: { username?: string; name?: string; id?: number };
  number?: { verified_name?: string; display_phone_number?: string; quality_rating?: string };
  smtp?: { host?: string; port?: number; authenticated?: boolean };
  account?: { friendly_name?: string; status?: string };
};

export type TestSendResult = {
  ok: boolean;
  status?: string;
  error?: string | null;
  channel?: string;
  sender?: string;
  id?: string | null;
};

export type HubLogRow = {
  name: string;
  channel: string;
  sender: string | null;
  /** Partially masked server-side — enough to recognise, not to harvest. */
  recipient: string;
  subject: string | null;
  status: string;
  message_id: string | null;
  company: string | null;
  app_source: string | null;
  reference_doctype: string | null;
  reference_name: string | null;
  error: string | null;
  creation: string;
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

async function get<T>(method: string, params?: Record<string, string>): Promise<T | null> {
  if (!BASE) return null;
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  try {
    const res = await fetch(`${BASE}/api/method/${NS}.${method}${qs}`, {
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

export function getHubStatus(): Promise<HubStatus | null> {
  return get<HubStatus>("hub_status");
}

export async function listSenders(): Promise<HubSender[]> {
  return (await get<HubSender[]>("list_senders")) ?? [];
}

export type SenderInput = {
  name?: string;
  sender_name?: string;
  channel?: string;
  enabled?: number;
  is_default?: number;
  company?: string;
  app_source?: string;
  priority?: number;
  config?: Record<string, unknown>;
  /** Only send when the operator typed a NEW credential — omit to keep the stored one. */
  secret?: string;
};

export function upsertSender(input: SenderInput): Promise<HubSender> {
  return post<HubSender>("upsert_sender", input, "تعذّر حفظ المرسِل.");
}

export function deleteSender(name: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>("delete_sender", { name }, "تعذّر حذف المرسِل.");
}

/** Fetch live data from the provider (WAHA sessions, bot identity, SMTP login). */
export function probeSender(name: string): Promise<ProbeResult> {
  return post<ProbeResult>("probe_sender", { name }, "تعذّر الاتصال بالمزوّد.");
}

export function sendTest(input: {
  recipient: string;
  body?: string;
  sender?: string;
  channel?: string;
  company?: string;
}): Promise<TestSendResult> {
  return post<TestSendResult>("send_test", input, "تعذّر إرسال رسالة الاختبار.");
}

export async function getMessageLog(params?: {
  limit?: number;
  status?: string;
  channel?: string;
  app_only?: number;
}): Promise<HubLogRow[]> {
  const qs: Record<string, string> = {};
  if (params?.limit) qs.limit = String(params.limit);
  if (params?.status) qs.status = params.status;
  if (params?.channel) qs.channel = params.channel;
  if (params?.app_only) qs.app_only = String(params.app_only);
  return (await get<HubLogRow[]>("message_log", qs)) ?? [];
}

/** Config keys each channel expects, so the form can offer the right inputs.
 *  Mirrors the hub's own per-channel help text; the secret is always separate. */
export const CHANNEL_FIELDS: Record<string, { key: string; placeholder: string }[]> = {
  email: [
    { key: "host", placeholder: "smtp.example.com" },
    { key: "port", placeholder: "587" },
    { key: "use_tls", placeholder: "true" },
    { key: "from_addr", placeholder: "store@example.com" },
    { key: "from_name", placeholder: "Ovira" },
    { key: "username", placeholder: "store@example.com" },
  ],
  telegram: [],
  whatsapp_waha: [
    { key: "base_url", placeholder: "http://waha:3000" },
    { key: "session", placeholder: "default" },
  ],
  whatsapp_official: [
    { key: "phone_id", placeholder: "123456789012345" },
    { key: "version", placeholder: "v21.0" },
  ],
  sms_http: [
    { key: "url", placeholder: "https://sms.example.com/send" },
    { key: "method", placeholder: "POST" },
    { key: "to_param", placeholder: "to" },
    { key: "text_param", placeholder: "text" },
    { key: "auth_header", placeholder: "Authorization" },
  ],
  sms_twilio: [
    { key: "account_sid", placeholder: "ACxxxxxxxx" },
    { key: "from_number", placeholder: "+15551234567" },
  ],
};

/** The label for the one encrypted secret each channel stores. */
export const SECRET_LABEL: Record<string, string> = {
  email: "password",
  telegram: "bot_token",
  whatsapp_waha: "api_key",
  whatsapp_official: "token",
  sms_http: "auth_value",
  sms_twilio: "auth_token",
};
