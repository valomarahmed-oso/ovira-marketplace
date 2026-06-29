"use client";

import { Bell, CheckCheck, Package, Settings, Tag } from "lucide-react";
import { KIND_LABEL, type NotificationKind, useNotifications } from "@/lib/notifications-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationKind, typeof Bell> = {
  order: Package,
  promo: Tag,
  system: Settings,
};

export default function NotificationsPage() {
  const notifications = useNotifications((s) => s.notifications);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="container-ovira py-10">
        <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>
      </div>
    );
  }

  return (
    <div className="container-ovira space-y-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">الإشعارات</h1>
        <button type="button" onClick={markAllRead} className="btn btn-ghost text-sm">
          <CheckCheck className="h-4 w-4" /> تعليم الكل كمقروء
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="card space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Bell className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-ink-400">لا توجد إشعارات.</p>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {notifications.map((n) => {
            const Icon = ICONS[n.kind];
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={cn("flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-blue-50", !n.read && "bg-blue-50/50")}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50">
                  <Icon className="h-5 w-5 text-blue-600" />
                </span>
                <div className="grow">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{n.title}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">{KIND_LABEL[n.kind]}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-coral" />}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-600">{n.body}</p>
                  <span className="text-xs text-ink-400">{n.date}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
