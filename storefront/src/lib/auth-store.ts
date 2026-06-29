import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  name: string;
  email: string;
  roles?: string[];
  isVendor?: boolean;
  isOperator?: boolean;
  vendor?: string | null;
  vendorStatus?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  /** True once the server session has been checked at least once. */
  ready: boolean;
  setUser: (u: AuthUser | null) => void;
  setReady: (ready: boolean) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      ready: false,
      setUser: (user) => set({ user }),
      setReady: (ready) => set({ ready }),
      signOut: () => set({ user: null }),
    }),
    {
      name: "ovira-auth",
      // Never persist `ready` — the server session must be re-validated each load.
      partialize: (s) => ({ user: s.user }),
    },
  ),
);
