import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Review = {
  id: string;
  author: string;
  rating: number;
  body: string;
  date: string;
};

const seed: Record<string, Review[]> = {
  "wireless-anc-headphones": [
    { id: "r1", author: "محمد", rating: 5, body: "جودة صوت ممتازة وعزل ضوضاء رهيب، تستاهل سعرها.", date: "2026-06-10" },
    { id: "r2", author: "سارة", rating: 4, body: "حلوة جدًا بس البطارية ممكن تكون أحسن.", date: "2026-06-12" },
  ],
  "amoled-smartwatch": [
    { id: "r3", author: "كريم", rating: 5, body: "الشاشة واضحة والساعة خفيفة، مبسوط بيها.", date: "2026-06-15" },
  ],
};

type ReviewsState = {
  reviews: Record<string, Review[]>;
  add: (slug: string, r: Omit<Review, "id" | "date">) => void;
};

export const useReviews = create<ReviewsState>()(
  persist(
    (set) => ({
      reviews: seed,
      add: (slug, r) =>
        set((s) => {
          const review: Review = {
            ...r,
            id: "r" + Math.floor(1000 + Math.random() * 9000),
            date: new Date().toISOString().slice(0, 10),
          };
          return { reviews: { ...s.reviews, [slug]: [review, ...(s.reviews[slug] ?? [])] } };
        }),
    }),
    { name: "ovira-reviews" },
  ),
);
