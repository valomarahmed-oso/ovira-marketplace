// Operator client for the notification pipeline: wording, preview, outbox.
//
// The event catalogue lives in the backend and is the source of truth for what
// the store can announce; this only ever edits the wording on top of it. So a
// new event ships working, and an operator's edit survives an upgrade.

import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const NS = "ovira_marketplace.api.notification_admin";

export type EventLanguage = {
  default_title: string;
  default_lines: string[];
  title: string;
  lines: string[];
  overridden: boolean;
  enabled: boolean;
};

export type NotificationEvent = {
  event: string;
  audience: "buyer" | "vendor" | "operator";
  transactional: boolean;
  channels: string[];
  languages: Record<"ar" | "en", EventLanguage>;
};

export type OutboxRow = {
  name: string;
  event: string;
  channel: string;
  status: "queued" | "retry" | "sent" | "failed" | "skipped";
  attempts: number;
  language: string;
  recipient: string;
  subject: string | null;
  last_error: string | null;
  reference_doctype: string | null;
  reference_name: string | null;
  sent_at: string | null;
  next_attempt_at: string | null;
  creation: string;
  transactional: number;
};

export type Preview = {
  title: string;
  lines: string[];
  email_subject: string;
  text: string;
  inapp: { title: string; message: string };
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
    if (!res.ok) {
      reportApiFailure("notifications-admin", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as T;
  } catch (err) {
    reportApiFailure("notifications-admin", err);
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

export async function listNotificationEvents(): Promise<NotificationEvent[]> {
  return (await get<NotificationEvent[]>("list_events")) ?? [];
}

export function saveTemplate(input: {
  event: string;
  language: "ar" | "en";
  title: string;
  lines: string[];
  enabled?: number;
}): Promise<{ ok: boolean }> {
  return post("save_template", { ...input, lines: input.lines.join("\n") }, "تعذّر حفظ النص.");
}

export function resetTemplate(event: string, language: "ar" | "en"): Promise<{ ok: boolean }> {
  return post("reset_template", { event, language }, "تعذّر استرجاع النص الأصلي.");
}

export function previewTemplate(input: {
  event: string;
  language: "ar" | "en";
  title?: string;
  lines?: string[];
}): Promise<Preview> {
  return post(
    "preview_template",
    { ...input, lines: input.lines ? input.lines.join("\n") : undefined },
    "تعذّرت المعاينة."
  );
}

export async function listOutbox(params?: {
  limit?: number;
  status?: string;
  channel?: string;
  event?: string;
}): Promise<OutboxRow[]> {
  const qs: Record<string, string> = {};
  if (params?.limit) qs.limit = String(params.limit);
  if (params?.status) qs.status = params.status;
  if (params?.channel) qs.channel = params.channel;
  if (params?.event) qs.event = params.event;
  return (await get<OutboxRow[]>("outbox", qs)) ?? [];
}

export function retryOutbox(name: string): Promise<{ status: string; last_error: string | null }> {
  return post("retry_outbox", { name }, "تعذّرت إعادة الإرسال.");
}

export async function outboxSummary(): Promise<Record<string, number>> {
  return (await get<Record<string, number>>("outbox_summary")) ?? {};
}

// ── customer-facing ─────────────────────────────────────────────────────────
export async function myNotificationPreferences(): Promise<{
  marketing_email: boolean;
  marketing_push: boolean;
} | null> {
  return get("my_preferences");
}

export function setMyNotificationPreferences(input: {
  marketing_email: number;
  marketing_push: number;
}): Promise<{ ok: boolean }> {
  return post("set_my_preferences", input, "تعذّر حفظ التفضيلات.");
}

export function unsubscribeByToken(token: string): Promise<{ ok: boolean }> {
  return post("unsubscribe", { token }, "تعذّر إلغاء الاشتراك.");
}
