import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartLine } from "@ovira/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The cart, held on the device.
 *
 * Deliberately a *local* record of intent, not a priced order. The prices in
 * here are what the shopper was shown; `api/checkout.place_order` recomputes
 * every one of them from the database and ignores what the client sends. That
 * is the server-trust rule this whole marketplace is built on, and the cart is
 * exactly where a client would be tempted to break it.
 *
 * It survives the app being closed, because a cart that empties itself
 * overnight is how a shopper decides not to bother.
 */

/** A product plus a chosen variant is a distinct line; the same product twice is not. */
function keyOf(line: Pick<CartLine, "slug" | "variant">): string {
  return `${line.slug}::${line.variant ?? ""}`;
}

type CartState = {
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (line) =>
        set((state) => {
          const key = keyOf(line);
          const existing = state.lines.find((l) => keyOf(l) === key);
          if (!existing) return { lines: [...state.lines, line] };
          // Adding the same thing twice tops up the line rather than stacking a
          // duplicate the shopper then has to reconcile by hand.
          const capped = cap(existing.qty + line.qty, line.stock_qty ?? existing.stock_qty);
          return {
            lines: state.lines.map((l) =>
              keyOf(l) === key ? { ...l, qty: capped, price: line.price } : l,
            ),
          };
        }),

      setQty: (key, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) => (keyOf(l) === key ? { ...l, qty: cap(qty, l.stock_qty) } : l))
            .filter((l) => l.qty > 0),
        })),

      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => keyOf(l) !== key) })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: "ovira-cart",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/**
 * Never let a line exceed what the shop said it had.
 *
 * The server refuses the order anyway — but finding out at the payment step
 * that one of six lines was never available is a worse experience than being
 * stopped at the plus button, and it is the same number either way.
 */
function cap(qty: number, stock?: number): number {
  const wanted = Math.max(0, Math.floor(qty));
  if (stock == null || stock <= 0) return wanted;
  return Math.min(wanted, Math.floor(stock));
}

export const cartKey = keyOf;

/** Total units, for the tab badge. */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}
