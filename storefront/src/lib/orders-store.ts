import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/cart-store";

export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

export type Order = {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  payment: "cod" | "card";
  address: { name: string; phone: string; gov: string; address: string };
};

type OrdersState = {
  orders: Order[];
  addOrder: (order: Order) => void;
};

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
    }),
    { name: "ovira-orders" },
  ),
);

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const ORDER_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "processing", label: "تم الطلب" },
  { key: "shipped", label: "تم الشحن" },
  { key: "delivered", label: "تم التسليم" },
];
