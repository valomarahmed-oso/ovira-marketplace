import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api";

/** The variant a cart line was added for (a product may appear once per variant). */
export type CartVariant = { sku: string; value: string; price: number };

export type CartItem = { product: Product; qty: number; variant?: CartVariant };

/** A cart line is identified by product + variant, so the same product can be in
 * the cart under different variants. */
export const lineId = (i: { product: Product; variant?: CartVariant }) =>
  `${i.product.slug}::${i.variant?.sku ?? ""}`;

/** Effective unit price — the variant's price when present, else the product's. */
export const unitPrice = (i: CartItem) => i.variant?.price ?? i.product.price;

type CartState = {
  items: CartItem[];
  add: (product: Product, qty?: number, variant?: CartVariant) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  /** Replace the whole cart (used by cross-device sync after a merge). */
  replaceAll: (items: CartItem[]) => void;
};

/** Merge two carts by line id, keeping the greater qty for shared lines so
 * repeated syncs stay idempotent (no runaway doubling). */
export function mergeCarts(a: CartItem[], b: CartItem[]): CartItem[] {
  const byId = new Map<string, CartItem>();
  for (const it of a) byId.set(lineId(it), { ...it });
  for (const it of b) {
    const id = lineId(it);
    const existing = byId.get(id);
    if (existing) existing.qty = Math.max(existing.qty, it.qty);
    else byId.set(id, { ...it });
  }
  return [...byId.values()];
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, qty = 1, variant) =>
        set((s) => {
          const id = lineId({ product, variant });
          const existing = s.items.find((i) => lineId(i) === id);
          if (existing) {
            return {
              items: s.items.map((i) => (lineId(i) === id ? { ...i, qty: i.qty + qty } : i)),
            };
          }
          return { items: [...s.items, { product, qty, variant }] };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => lineId(i) !== id) })),
      setQty: (id, qty) =>
        set((s) => ({
          items: s.items.map((i) => (lineId(i) === id ? { ...i, qty: Math.max(1, qty) } : i)),
        })),
      clear: () => set({ items: [] }),
      replaceAll: (items) => set({ items }),
    }),
    { name: "ovira-cart" },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + unitPrice(i) * i.qty, 0);

export const SHIPPING_FREE_THRESHOLD = 500;
export const SHIPPING_FLAT = 50;

export function shippingFor(subtotal: number) {
  if (subtotal <= 0) return 0;
  return subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FLAT;
}
