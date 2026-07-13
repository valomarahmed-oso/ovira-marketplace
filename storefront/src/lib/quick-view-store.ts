import { create } from "zustand";
import type { Product } from "@/lib/api";

/** Drives the global quick-view modal. The card hands over the summary it
 * already has (instant paint); the modal fetches the full product for the
 * gallery + description. */
type QuickViewState = {
  product: Product | null;
  open: (p: Product) => void;
  close: () => void;
};

export const useQuickView = create<QuickViewState>((set) => ({
  product: null,
  open: (p) => set({ product: p }),
  close: () => set({ product: null }),
}));
