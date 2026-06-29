import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationKind = "order" | "promo" | "system";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  date: string;
  read: boolean;
};

const seed: Notification[] = [
  { id: "n1", kind: "order", title: "تم شحن طلبك", body: "طلب OVR-7K2M9X في الطريق إليك.", date: "2026-06-27", read: false },
  { id: "n2", kind: "promo", title: "خصم ٢٠٪ على الإلكترونيات", body: "عروض لفترة محدودة، لا تفوّتها.", date: "2026-06-26", read: false },
  { id: "n3", kind: "system", title: "أهلاً بك في أوفيرا", body: "ابدأ التسوّق واكتشف آلاف المنتجات.", date: "2026-06-25", read: true },
];

type NotificationsState = {
  notifications: Notification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
};

export const useNotifications = create<NotificationsState>()(
  persist(
    (set) => ({
      notifications: seed,
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    }),
    { name: "ovira-notifications" },
  ),
);

export const KIND_LABEL: Record<NotificationKind, string> = {
  order: "طلب",
  promo: "عرض",
  system: "النظام",
};
