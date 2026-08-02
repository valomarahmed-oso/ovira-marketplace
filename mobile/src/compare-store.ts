import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProductCard } from "@ovira/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { toCard } from "./product-summary";

/**
 * The comparison tray.
 *
 * Local only, and deliberately so — unlike the wishlist this is a scratchpad
 * for one shopping session, not a list anyone wants to find again on another
 * device. It persists across app restarts for the same reason the cart does:
 * comparing four laptops is not something to have to redo.
 */

/** Four columns is what a comparison stays readable at, on any screen. */
export const COMPARE_MAX = 4;

type CompareState = {
  items: ProductCard[];
  toggle: (product: ProductCard) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

export const useCompare = create<CompareState>()(
  persist(
    (set) => ({
      items: [],

      toggle: (product) =>
        set((state) => {
          if (state.items.some((i) => i.slug === product.slug)) {
            return { items: state.items.filter((i) => i.slug !== product.slug) };
          }
          // Full: ignore rather than evict. Silently dropping the first product
          // someone chose to compare is worse than refusing the fifth.
          if (state.items.length >= COMPARE_MAX) return state;
          return { items: [...state.items, toCard(product)] };
        }),

      remove: (slug) => set((state) => ({ items: state.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
    }),
    { name: "ovira-compare", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const inCompare = (items: ProductCard[], slug: string) =>
  items.some((i) => i.slug === slug);
