import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProductCard } from "@ovira/core";
import { getServerWishlist, mergeWishlists, saveServerWishlist } from "@ovira/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { toCard } from "./product-summary";

/**
 * Saved items, on the device first.
 *
 * A guest has a wishlist and keeps it — gating "save for later" behind a login
 * is how a shopper loses the thing they came back for. The server copy is a
 * mirror that makes the list follow them to the website and to a second phone.
 */

type WishlistState = {
  items: ProductCard[];
  toggle: (product: ProductCard) => void;
  remove: (slug: string) => void;
  clear: () => void;
  replaceAll: (items: ProductCard[]) => void;
};


export const useWishlist = create<WishlistState>()(
  persist(
    (set) => ({
      items: [],

      toggle: (product) =>
        set((state) =>
          state.items.some((i) => i.slug === product.slug)
            ? { items: state.items.filter((i) => i.slug !== product.slug) }
            : { items: [toCard(product), ...state.items] },
        ),

      remove: (slug) => set((state) => ({ items: state.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
      replaceAll: (items) => set({ items }),
    }),
    { name: "ovira-wishlist", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const inWishlist = (items: ProductCard[], slug: string) =>
  items.some((i) => i.slug === slug);

/**
 * Reconcile this device's list with the account's, once, after signing in.
 *
 * A union, not a replacement, and in that order: what was saved on this phone
 * before signing in survives, and so does what was saved on the website. The
 * merged result is pushed back so both sides agree from here on.
 */
export async function syncWishlist(): Promise<void> {
  const local = useWishlist.getState().items;
  const remote = await getServerWishlist();
  const merged = mergeWishlists(local, remote);
  useWishlist.getState().replaceAll(merged);
  // Only write when the merge actually changed the server's copy — a no-op
  // POST on every app start is a write the shopper did not ask for.
  if (merged.length !== remote.length) await saveServerWishlist(merged);
}

/** Push the current list up. Safe to call on every change; guests no-op server-side. */
export async function pushWishlist(): Promise<void> {
  await saveServerWishlist(useWishlist.getState().items);
}
