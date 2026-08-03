import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartLine } from "@ovira/core";
import { getServerCart, mergeCarts, saveServerCart } from "@ovira/core";
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
          // duplicate the shopper then has to reconcile by hand. `price` and
          // `tiers` are refreshed from the newer read because they are the
          // *base* figures — the effective unit price is derived from the
          // quantity by `lineUnitPrice`, so a top-up can never cost a shopper a
          // bulk discount they had already earned.
          const capped = cap(existing.qty + line.qty, line.stock_qty ?? existing.stock_qty);
          return {
            lines: state.lines.map((l) =>
              keyOf(l) === key
                ? { ...l, qty: capped, price: line.price, tiers: line.tiers, stock_qty: line.stock_qty }
                : l,
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
      /**
       * Bumped when `price` stopped meaning "what we charge" and started
       * meaning "the base rate".
       *
       * Old lines are kept rather than discarded: they carry no `tiers`, so
       * they price at exactly the figure they were saved with, and the server
       * recomputes the charge regardless. Throwing away someone's cart to
       * tidy up a field's meaning would cost more than it fixes.
       */
      version: 2,
      migrate: (state) => state as CartState,
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

/**
 * Reconcile this device's cart with the account's, once, after signing in.
 *
 * A union by line, and quantities are **not** added: someone who put two of
 * something in on their phone and two on the website wants two, not four — the
 * same intention recorded twice, not two decisions. The larger of the two wins,
 * which is the reading that never silently inflates an order.
 */
export async function syncCart(): Promise<void> {
  const local = useCart.getState().lines;
  const remote = await getServerCart();
  if (!remote.length && !local.length) return;
  const merged = mergeCarts(local, remote);
  useCart.setState({ lines: merged });
  // Only write when the merge actually changed the server's copy — a no-op
  // POST on every app start is a write the shopper did not ask for.
  if (merged.length !== remote.length) await saveServerCart(merged);
}

/** Push the current cart up. Guests no-op server-side. */
export async function pushCart(): Promise<void> {
  await saveServerCart(useCart.getState().lines);
}
