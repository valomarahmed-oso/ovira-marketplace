import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api";

export type CartItem = { product: Product; qty: number };

type CartState = {
  items: CartItem[];
  add: (product: Product, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.product.slug === product.slug);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.product.slug === product.slug ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return { items: [...s.items, { product, qty }] };
        }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.product.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.product.slug === slug ? { ...i, qty: Math.max(1, qty) } : i,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "ovira-cart" },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.product.price * i.qty, 0);

export const SHIPPING_FREE_THRESHOLD = 500;
export const SHIPPING_FLAT = 50;

export function shippingFor(subtotal: number) {
  if (subtotal <= 0) return 0;
  return subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FLAT;
}
