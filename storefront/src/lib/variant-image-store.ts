import { create } from "zustand";

/** Bridges the two sibling components on the product page: ProductPurchase
 *  (which owns variant selection) pushes the chosen variant's image here, and
 *  ProductGallery reads it to swap the hero image. Null = no variant image, so
 *  the gallery falls back to the product's own photos. */
type VariantImageState = {
  image: string | null;
  setImage: (image: string | null) => void;
};

export const useVariantImage = create<VariantImageState>((set) => ({
  image: null,
  setImage: (image) => set({ image }),
}));
