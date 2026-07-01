"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2, Package, Settings, Tag } from "lucide-react";
import {
  getMyNotifications,
  KIND_LABEL,
  markAllRead,
  markRead,
  type BuyerNotification,
  type NotificationKind,
} from "@/lib/notifications-api";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationKind, typeof Bell> = {
  order: Package,
  promo: Tag,
  system: Settings,
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<BuyerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyNotifications()
      .then(setNotifications)
      .finally(() => setLoading(false));
  }, []);

  async function onMarkRead(name: string) {
    setNotifications((list) => list.map((n) => (n.name === name ? { ...n, is_read: 1 } : n)));
    await markRead(name);
  }

  async function onMarkAllRead() {
    setNotifications((list) => list.map((n) => ({ ...n, is_read: 1 })));
    await markAllRead();
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">الإشعارات</h1>
        <button type="button" onClick={onMarkAllRead} className="btn btn-ghost text-sm">
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
            const Icon = ICONS[n.kind] ?? Bell;
            const read = Boolean(n.is_read);
            return (
              <button
                key={n.name}
                type="button"
                onClick={() => onMarkRead(n.name)}
                className={cn("flex w-full items-start gap-3 p-4 text-start transition-colors hover:bg-blue-50", !read && "bg-blue-50/50")}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50">
                  <Icon className="h-5 w-5 text-blue-600" />
                </span>
                <div className="grow">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{n.title}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">{KIND_LABEL[n.kind] ?? n.kind}</span>
                    {!read && <span className="h-2 w-2 rounded-full bg-coral" />}
                  </div>
                  {n.message && <p className="mt-0.5 text-sm text-ink-600">{n.message}</p>}
                  <span className="text-xs text-ink-400">{formatDate(n.creation)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
