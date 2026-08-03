import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProductCard } from "@ovira/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { toCard } from "./product-summary";

/**
 * The last few products this person opened.
 *
 * Device-local and never sent anywhere. It is browsing history, which is the
 * kind of data a store should keep as little of as possible — and it is more
 * useful here anyway, since the point is "take me back to the one I was
 * looking at", not analytics.
 */

/** Enough to find your way back, few enough to stay one swipe. */
const MAX = 12;

type RecentState = {
  items: ProductCard[];
  push: (product: ProductCard) => void;
  clear: () => void;
};

export const useRecentlyViewed = create<RecentState>()(
  persist(
    (set) => ({
      items: [],

      push: (product) =>
        set((state) => ({
          // Re-opening something moves it to the front rather than duplicating
          // it — a rail showing the same product three times is a bug the
          // shopper sees.
          items: [toCard(product), ...state.items.filter((i) => i.slug !== product.slug)].slice(
            0,
            MAX,
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    { name: "ovira-recently-viewed", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
