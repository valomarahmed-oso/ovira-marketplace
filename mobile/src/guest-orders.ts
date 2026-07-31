import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Capability tokens for orders placed without an account.
 *
 * A guest order has no owner, so `orders.get_order` refuses it — correctly, or
 * anyone could read any order by guessing an id. `place_order` hands back an
 * `access_token` instead, and `orders.track_order` accepts it as proof.
 *
 * Without somewhere to keep that token, the app showed a shopper "الصفحة غير
 * موجودة" for the order they had placed one second earlier. The token is the
 * guest's only claim on their own order, so it is persisted: losing it means
 * losing sight of a delivery they have already committed to pay for.
 *
 * Kept out of the navigation URL deliberately — a route parameter ends up in
 * history and in any deep link the shopper shares.
 */
type GuestOrders = {
  tokens: Record<string, string>;
  remember: (order: string, token?: string | null) => void;
  tokenFor: (order: string) => string | undefined;
  forget: (order: string) => void;
};

export const useGuestOrders = create<GuestOrders>()(
  persist(
    (set, get) => ({
      tokens: {},
      remember: (order, token) => {
        if (!order || !token) return;
        set((state) => ({ tokens: { ...state.tokens, [order]: token } }));
      },
      tokenFor: (order) => get().tokens[order],
      forget: (order) =>
        set((state) => {
          const { [order]: _gone, ...rest } = state.tokens;
          return { tokens: rest };
        }),
    }),
    {
      name: "ovira-guest-orders",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/** Newest first — the order list for someone who never signed in. */
export function guestOrderNames(tokens: Record<string, string>): string[] {
  return Object.keys(tokens).reverse();
}
