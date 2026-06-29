import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Address = {
  id: string;
  name: string;
  phone: string;
  gov: string;
  address: string;
  isDefault?: boolean;
};

type AddressState = {
  addresses: Address[];
  add: (a: Omit<Address, "id" | "isDefault">) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
};

export const useAddresses = create<AddressState>()(
  persist(
    (set) => ({
      addresses: [],
      add: (a) =>
        set((s) => {
          const id = "ADR-" + Math.floor(1000 + Math.random() * 9000);
          const isDefault = s.addresses.length === 0;
          return { addresses: [...s.addresses, { ...a, id, isDefault }] };
        }),
      remove: (id) => set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) })),
      setDefault: (id) =>
        set((s) => ({
          addresses: s.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
        })),
    }),
    { name: "ovira-addresses" },
  ),
);

export const GOVERNORATES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "الدقهلية",
  "الشرقية",
  "القليوبية",
  "أخرى",
];
