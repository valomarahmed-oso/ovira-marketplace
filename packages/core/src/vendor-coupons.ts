/**
 * A seller's own coupons.
 *
 * These are **vendor-funded**: the discount comes off what the seller is paid,
 * not off the operator's commission. That is why the endpoints are separate
 * from the operator's `upsert_coupon` and scoped server-side to the caller's
 * store — a vendor must not be able to spend someone else's money.
 */

import { get, post } from "./http.js";

const NS = "ovira_marketplace.api.coupons";

export type DiscountType = "Percentage" | "Fixed";

export type Coupon = {
  code: string;
  description?: string | null;
  vendor?: string | null;
  active: 0 | 1;
  discount_type: DiscountType;
  discount_value: number;
  /** Caps a percentage discount. 0 means uncapped. */
  max_discount?: number;
  /** The cart has to reach this before the code applies. */
  min_subtotal?: number;
  expires_on?: string | null;
  /** 0 means unlimited. */
  usage_limit?: number;
  used_count?: number;
};

export type CouponInput = {
  code: string;
  discount_type?: DiscountType;
  discount_value?: number;
  description?: string | null;
  max_discount?: number;
  min_subtotal?: number;
  usage_limit?: number;
  expires_on?: string | null;
  active?: 0 | 1;
};

export async function myCoupons(): Promise<Coupon[]> {
  return (await get<Coupon[]>(`${NS}.my_coupons`)) ?? [];
}

export function upsertMyCoupon(input: CouponInput): Promise<Coupon> {
  return post(`${NS}.upsert_my_coupon`, input, "تعذّر حفظ الكوبون.");
}

export function deleteMyCoupon(code: string): Promise<{ deleted: string | null }> {
  return post(`${NS}.delete_my_coupon`, { code }, "تعذّر حذف الكوبون.");
}
