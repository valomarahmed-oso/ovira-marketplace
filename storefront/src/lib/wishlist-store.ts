import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api";

type WishlistState = {
  items: Product[];
  toggle: (p: Product) => void;
  remove: (slug: string) => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (p) =>
        set((s) =>
          s.items.some((i) => i.slug === p.slug)
            ? { items: s.items.filter((i) => i.slug !== p.slug) }
            : { items: [p, ...s.items] },
        ),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
    }),
    { name: "ovira-wishlist" },
  ),
);
