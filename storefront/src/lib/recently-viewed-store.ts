import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api";

/** The card fields we keep for a viewed product — enough to render a ProductCard
 * and add it to the cart, without storing the full detail payload. */
export type ViewedProduct = Pick<
  Product,
  | "name"
  | "slug"
  | "title"
  | "price"
  | "compare_at_price"
  | "currency"
  | "vendor"
  | "vendor_name"
  | "image"
  | "rating"
  | "reviews"
  | "stock_qty"
  | "has_variants"
>;

const MAX = 12;

type State = {
  items: ViewedProduct[];
  record: (p: ViewedProduct) => void;
  clear: () => void;
};

export const useRecentlyViewed = create<State>()(
  persist(
    (set) => ({
      items: [],
      record: (p) =>
        set((s) => {
          if (!p.slug) return s;
          const rest = s.items.filter((i) => i.slug !== p.slug);
          return { items: [p, ...rest].slice(0, MAX) };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "ovira-recently-viewed" },
  ),
);

/** Trim a full product down to the stored card shape. */
export function toViewed(p: Product): ViewedProduct {
  return {
    name: p.name,
    slug: p.slug,
    title: p.title,
    price: p.price,
    compare_at_price: p.compare_at_price,
    currency: p.currency,
    vendor: p.vendor,
    vendor_name: p.vendor_name,
    image: p.image,
    rating: p.rating,
    reviews: p.reviews,
    stock_qty: p.stock_qty,
    has_variants: p.has_variants,
  };
}
