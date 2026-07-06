"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-store";
import { mergeWishlists, useWishlist } from "@/lib/wishlist-store";
import { getServerWishlist, saveServerWishlist } from "@/lib/wishlist-api";

/**
 * Cross-device wishlist sync — mirrors the cross-device cart:
 *  - on sign-in, pull the server wishlist, merge it with the local one, and
 *    push the merged result back (a guest wishlist carries into the account);
 *  - thereafter, mirror every local change to the server (debounced);
 *  - on sign-out, drop the local wishlist (it's safe on the server).
 *
 * Guests keep a purely local wishlist; nothing is sent until they sign in.
 */
export function WishlistSync() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const email = user?.email ?? null;

  const prevEmail = useRef<string | null | undefined>(undefined);
  const syncing = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    const prev = prevEmail.current;
    if (email === prev) return;
    prevEmail.current = email;

    if (!email) {
      if (prev) useWishlist.getState().replaceAll([]); // genuine sign-out clears
      syncing.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      return;
    }

    let cancelled = false;
    (async () => {
      const server = await getServerWishlist();
      if (cancelled) return;
      const merged = mergeWishlists(useWishlist.getState().items, server);
      useWishlist.getState().replaceAll(merged); // fires before syncing=true → no double save
      syncing.current = true;
      await saveServerWishlist(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, email]);

  useEffect(() => {
    const unsub = useWishlist.subscribe((state) => {
      if (!syncing.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void saveServerWishlist(state.items), 800);
    });
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return null;
}
