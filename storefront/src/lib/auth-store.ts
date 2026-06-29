import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = { name: string; email: string };

type AuthState = {
  user: AuthUser | null;
  setUser: (u: AuthUser) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    { name: "ovira-auth" },
  ),
);
