import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api";

/** How many products can sit in the comparison tray at once. */
export const COMPARE_MAX = 4;

type CompareState = {
  items: Product[];
  toggle: (p: Product) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

export const useCompare = create<CompareState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (p) =>
        set((s) => {
          if (s.items.some((i) => i.slug === p.slug)) {
            return { items: s.items.filter((i) => i.slug !== p.slug) };
          }
          if (s.items.length >= COMPARE_MAX) return s; // full — ignore
          return { items: [...s.items, p] };
        }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
    }),
    { name: "ovira-compare" },
  ),
);

export const inCompare = (items: Product[], slug: string) => items.some((i) => i.slug === slug);
