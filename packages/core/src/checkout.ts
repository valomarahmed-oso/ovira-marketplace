/** Placing an order, and the store configuration the cart needs to price it. */

import { get, post } from "./http.js";
import type { CartLine, StoreConfig } from "./types.js";

const NS = "ovira_marketplace.api";

export type CustomerInfo = {
  name: string;
  phone: string;
  email?: string;
  gov?: string;
  address?: string;
};

export type PlacedOrder = {
  name: string;
  total: number;
  status: string;
  token?: string;
  /** True when this was a repeat of a key the server had already seen. */
  idempotent_replay?: boolean;
};

/**
 * One checkout ATTEMPT, held until an order actually succeeds.
 *
 * A double tap, a dropped connection the platform retried, a back button — all
 * of them post the same cart again. Sending the same key means the server hands
 * back the order it already made instead of creating a second one with a second
 * stock reservation and a second charge. Cleared only on success, so a genuine
 * failure can still be retried.
 */
let attemptKey: string | null = null;

export function checkoutAttemptKey(): string {
  if (!attemptKey) {
    attemptKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `k${Date.now()}${Math.random().toString(36).slice(2)}`;
  }
  return attemptKey;
}

export function resetCheckoutAttempt(): void {
  attemptKey = null;
}

export async function placeOrder(input: {
  lines: CartLine[];
  customer: CustomerInfo;
  paymentMethod?: string;
  coupon?: string;
  useWallet?: boolean;
  shippingMethod?: string;
  preferredCarrier?: string;
  attribution?: Record<string, string>;
}): Promise<PlacedOrder> {
  const order = await post<PlacedOrder>(
    `${NS}.checkout.place_order`,
    {
      items: input.lines.map((l) => ({ slug: l.slug, qty: l.qty, variant: l.variant ?? undefined })),
      customer: input.customer,
      payment_method: input.paymentMethod ?? "cod",
      coupon: input.coupon,
      use_wallet: !!input.useWallet,
      shipping_method: input.shippingMethod,
      preferred_carrier: input.preferredCarrier,
      attribution: input.attribution,
      idempotency_key: checkoutAttemptKey(),
    },
    "تعذّر إتمام الطلب.",
  );
  if (order?.name) resetCheckoutAttempt();
  return order;
}

/** Live shipping quote for a cart — mode-aware, recomputed server-side. */
export async function shippingPreview(lines: CartLine[], governorate?: string): Promise<number> {
  const res = await get<number>(`${NS}.shipping.preview`, {
    items: JSON.stringify(lines.map((l) => ({ slug: l.slug, qty: l.qty }))),
    governorate,
  });
  return res ?? 0;
}

export async function validateCoupon(
  code: string,
  subtotal: number,
): Promise<{ discount: number; code?: string; reason?: string }> {
  try {
    return await post(`${NS}.coupons.validate_coupon`, { code, subtotal }, "كوبون غير صالح.");
  } catch (err) {
    return { discount: 0, reason: err instanceof Error ? err.message : "كوبون غير صالح." };
  }
}

const DEFAULT_CONFIG: StoreConfig = {
  multiVendor: true,
  currency: "EGP",
  onlinePayment: false,
  shippingMode: "Operator",
  tax: null,
};

export async function storeConfig(): Promise<StoreConfig> {
  const live = await get<{
    multi_vendor: boolean;
    currency: string;
    online_payment: boolean;
    shipping_mode: StoreConfig["shippingMode"];
    tax?: { rate?: number; inclusive?: boolean; label?: string | null };
  }>(`${NS}.settings.get_public_config`);
  if (!live) return DEFAULT_CONFIG;
  return {
    multiVendor: !!live.multi_vendor,
    currency: live.currency || "EGP",
    onlinePayment: !!live.online_payment,
    shippingMode: live.shipping_mode ?? "Operator",
    tax: live.tax?.rate
      ? { rate: Number(live.tax.rate), inclusive: !!live.tax.inclusive, label: live.tax.label ?? null }
      : null,
  };
}
