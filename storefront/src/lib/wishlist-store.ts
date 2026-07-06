import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api";

type WishlistState = {
  items: Product[];
  toggle: (p: Product) => void;
  remove: (slug: string) => void;
  /** Replace the whole wishlist (used by cross-device sync after a merge). */
  replaceAll: (items: Product[]) => void;
};

/** Merge two wishlists by slug (union, local order first). Idempotent. */
export function mergeWishlists(a: Product[], b: Product[]): Product[] {
  const seen = new Set(a.map((i) => i.slug));
  return [...a, ...b.filter((i) => !seen.has(i.slug))];
}

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
      replaceAll: (items) => set({ items }),
    }),
    { name: "ovira-wishlist" },
  ),
);
