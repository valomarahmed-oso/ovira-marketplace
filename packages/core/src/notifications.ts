/** The in-app notification centre. Push delivery lives in `push.ts`. */

import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.notifications";

export type Notification = {
  name: string;
  kind: string;
  title: string;
  message?: string;
  is_read: 0 | 1;
  creation: string;
  /** What it is about, so a tap can open the thing rather than the list. */
  reference_doctype?: string | null;
  reference_name?: string | null;
};

export async function myNotifications(limit = 50): Promise<Notification[]> {
  return (await get<Notification[]>(`${NS}.my_notifications`, { limit })) ?? [];
}

/** For the bell badge. 0 rather than a throw when signed out. */
export async function notificationsUnread(): Promise<number> {
  return (await get<number>(`${NS}.unread_count`)) ?? 0;
}

export function markNotificationRead(name: string): Promise<unknown> {
  return post(`${NS}.mark_read`, { name }, "تعذّر تحديث الإشعار.");
}

export function markAllNotificationsRead(): Promise<unknown> {
  return post(`${NS}.mark_all_read`, {}, "تعذّر تحديث الإشعارات.");
}
