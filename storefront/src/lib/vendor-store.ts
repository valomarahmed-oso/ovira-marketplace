import { create } from "zustand";
import { persist } from "zustand/middleware";

export type VendorProductStatus = "Draft" | "Pending" | "Approved" | "Rejected";

export type VendorProduct = {
  id: string;
  title: string;
  category?: string;
  price: number;
  compare_at_price?: number;
  stock: number;
  condition: "New" | "Used" | "Refurbished";
  status: VendorProductStatus;
  image?: string;
  description?: string;
};

const seed: VendorProduct[] = [
  {
    id: "PRD-1001", title: "سماعات لاسلكية بخاصية عزل الضوضاء", category: "إلكترونيات",
    price: 2499, compare_at_price: 3200, stock: 42, condition: "New", status: "Approved",
    image: "https://picsum.photos/seed/ovira-headphones/300/300",
  },
  {
    id: "PRD-1002", title: "لوحة مفاتيح ميكانيكية للألعاب RGB", category: "إلكترونيات",
    price: 1650, stock: 0, condition: "New", status: "Approved",
    image: "https://picsum.photos/seed/ovira-keyboard/300/300",
  },
  {
    id: "PRD-1003", title: "حقيبة ظهر مقاومة للماء بمنفذ USB", category: "موضة",
    price: 690, compare_at_price: 950, stock: 120, condition: "New", status: "Pending",
    image: "https://picsum.photos/seed/ovira-backpack/300/300",
  },
];

type VendorState = {
  storeName: string;
  products: VendorProduct[];
  addProduct: (p: Omit<VendorProduct, "id" | "status">) => void;
  removeProduct: (id: string) => void;
};

export const useVendor = create<VendorState>()(
  persist(
    (set) => ({
      storeName: "متجري على أوفيرا",
      products: seed,
      addProduct: (p) =>
        set((s) => ({
          products: [
            { ...p, id: "PRD-" + Math.floor(1000 + Math.random() * 9000), status: "Pending" },
            ...s.products,
          ],
        })),
      removeProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
    }),
    { name: "ovira-vendor" },
  ),
);

export const PRODUCT_STATUS_LABEL: Record<VendorProductStatus, string> = {
  Draft: "مسودة",
  Pending: "بانتظار المراجعة",
  Approved: "معتمد",
  Rejected: "مرفوض",
};

export const PRODUCT_STATUS_STYLE: Record<VendorProductStatus, string> = {
  Draft: "bg-[#f1efe8] text-ink-600",
  Pending: "bg-[#fdf2dd] text-[#854f0b]",
  Approved: "bg-[#e7f8f1] text-mint",
  Rejected: "bg-coral-50 text-coral",
};
