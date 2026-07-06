"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-store";
import { mergeCarts, useCart } from "@/lib/cart-store";
import { getServerCart, saveServerCart } from "@/lib/cart-api";

/**
 * Keeps the shopper's cart in sync across devices while signed in:
 *  - on sign-in, pull the server cart, merge it with whatever is local, and
 *    push the merged result back (so a guest cart carries into the account);
 *  - thereafter, mirror every local change to the server (debounced);
 *  - on sign-out, drop the local cart (it's safe on the server) so the next
 *    person on the device — or the same person as a guest — starts clean.
 *
 * Guests keep a purely local cart; nothing is sent until they sign in.
 */
export function CartSync() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const email = user?.email ?? null;

  const prevEmail = useRef<string | null | undefined>(undefined);
  const syncing = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Handle sign-in / sign-out transitions (only after the session is validated).
  useEffect(() => {
    if (!ready) return;
    const prev = prevEmail.current;
    if (email === prev) return;
    prevEmail.current = email;

    if (!email) {
      // A genuine sign-out (we had a user before) clears local; an initial
      // guest load (prev === undefined) must NOT wipe a guest's saved cart.
      if (prev) useCart.getState().clear();
      syncing.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      return;
    }

    let cancelled = false;
    (async () => {
      const server = await getServerCart();
      if (cancelled) return;
      const merged = mergeCarts(useCart.getState().items, server);
      useCart.getState().replaceAll(merged); // fires before syncing=true → no double save
      syncing.current = true;
      await saveServerCart(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, email]);

  // Mirror local cart changes to the server while signed in (debounced).
  useEffect(() => {
    const unsub = useCart.subscribe((state) => {
      if (!syncing.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void saveServerCart(state.items), 800);
    });
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return null;
}
