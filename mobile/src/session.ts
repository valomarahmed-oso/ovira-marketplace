import { me, register, signIn, signOut, type SessionUser } from "@ovira/core";
import { create } from "zustand";

import { setCsrfToken } from "./ovira";
import { syncWishlist } from "./wishlist-store";

/**
 * Reconcile saved items with the account, without letting that hold up — or
 * break — signing in. A wishlist merge is a convenience; identity is not.
 */
function mergeSavedItems(user: SessionUser | null): void {
  if (!user) return;
  void syncWishlist().catch(() => {
    /* the device's list is still correct; the next sign-in retries */
  });
}

/**
 * Who is signed in.
 *
 * The session itself lives in the platform's cookie store, not here — React
 * Native's fetch is backed by a real native cookie jar (OkHttp on Android,
 * NSHTTPCookieStorage on iOS), so a Frappe `sid` survives an app restart exactly
 * as it does in a browser. This store only holds what the UI needs to render,
 * and re-asks the server on launch rather than trusting anything it wrote down.
 *
 * The CSRF token is pushed into the API layer on every refresh. Frappe rejects
 * an authenticated write without it and the failure reads as a bare "Invalid
 * Request" with no hint of the cause — so it is set in exactly one place,
 * whenever identity changes, and never remembered anywhere else.
 */
type SessionState = {
  user: SessionUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
  logOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set) => ({
  user: null,
  // False until the first `me()` answers. Screens must wait for it: rendering a
  // "sign in" prompt for half a second to someone who is already signed in is
  // the kind of flicker that makes an app feel broken.
  ready: false,

  refresh: async () => {
    const session = await me();
    setCsrfToken(session.csrfToken ?? null);
    set({ user: session.user, ready: true });
    mergeSavedItems(session.user);
  },

  logIn: async (email, password) => {
    const session = await signIn(email, password);
    setCsrfToken(session.csrfToken ?? null);
    set({ user: session.user, ready: true });
    mergeSavedItems(session.user);
  },

  signUp: async (input) => {
    const session = await register(input);
    setCsrfToken(session.csrfToken ?? null);
    set({ user: session.user, ready: true });
    mergeSavedItems(session.user);
  },

  logOut: async () => {
    await signOut();
    setCsrfToken(null);
    set({ user: null, ready: true });
    // The cart is deliberately NOT cleared. It belongs to the device, not the
    // account: someone signing out on a shared phone should not lose what they
    // were about to buy, and the server re-prices everything anyway.
  },
}));
