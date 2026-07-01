const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type NotificationKind = "order" | "promo" | "system";

export type BuyerNotification = {
  name: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  is_read: number | boolean;
  creation: string;
  reference_doctype?: string;
  reference_name?: string;
};

export const KIND_LABEL: Record<NotificationKind, string> = {
  order: "طلب",
  promo: "عرض",
  system: "النظام",
};

async function post(method: string, body: Record<string, unknown> = {}): Promise<void> {
  if (!BASE) return;
  await fetch(`${BASE}/api/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
}

export async function getMyNotifications(): Promise<BuyerNotification[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.notifications.my_notifications`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as BuyerNotification[];
  } catch {
    return [];
  }
}

export async function getUnreadCount(): Promise<number> {
  if (!BASE) return 0;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.notifications.unread_count`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return 0;
    return Number((await res.json()).message ?? 0);
  } catch {
    return 0;
  }
}

export function markRead(name: string) {
  return post("ovira_marketplace.api.notifications.mark_read", { name });
}

export function markAllRead() {
  return post("ovira_marketplace.api.notifications.mark_all_read");
}
