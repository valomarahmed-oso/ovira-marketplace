import { useStoreConfig } from "./store-config";
import { useSession } from "./session";

/**
 * Whether this person should be shown a seller area at all.
 *
 * Two conditions, and the second is the one that is easy to forget. A store
 * running in **Single Company** mode has no sellers — the operator *is* the only
 * vendor — and surfacing "my store" there invents a marketplace the owner
 * deliberately turned off. The web storefront already hides its vendor screens
 * for exactly this reason; the app has to make the same call or it reintroduces
 * the confusion on a smaller screen.
 */
export type VendorAccess =
  | { show: false; reason: "loading" | "not-a-vendor" | "single-company" }
  | { show: true; status: string | null };

export function useVendorAccess(): VendorAccess {
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const config = useStoreConfig();

  if (!ready || !config) return { show: false, reason: "loading" };
  if (!user?.isVendor) return { show: false, reason: "not-a-vendor" };
  if (!config.multiVendor) return { show: false, reason: "single-company" };
  // A suspended or pending seller still gets the area — they need to be told
  // why they have no orders, and hiding it looks like the app has lost them.
  return { show: true, status: user.vendorStatus ?? null };
}
