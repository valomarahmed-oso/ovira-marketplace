/**
 * The signed-in buyer's own records: addresses, store credit, loyalty points.
 *
 * Every read here degrades to an empty value on failure, as everywhere else in
 * this package — but a wallet that reads zero because the request failed is a
 * different kind of wrong from an empty product rail, so callers should show the
 * balance as unknown rather than as nothing when `null` comes back.
 */

import { get, post } from "./http.js";

// -- addresses -------------------------------------------------------------

const ADDR = "ovira_marketplace.api.addresses";

export type BuyerAddress = {
  name: string;
  full_name: string;
  phone?: string;
  governorate: string;
  address: string;
  is_default: boolean;
};

export type AddressInput = {
  name?: string;
  full_name: string;
  address: string;
  governorate: string;
  phone?: string;
  is_default?: 0 | 1;
};

export async function myAddresses(): Promise<BuyerAddress[]> {
  return (await get<BuyerAddress[]>(`${ADDR}.my_addresses`)) ?? [];
}

export async function saveAddress(input: AddressInput): Promise<BuyerAddress> {
  return post<BuyerAddress>(`${ADDR}.upsert_address`, input, "تعذّر حفظ العنوان.");
}

export async function deleteAddress(name: string): Promise<void> {
  await post(`${ADDR}.delete_address`, { name }, "تعذّر حذف العنوان.");
}

export async function setDefaultAddress(name: string): Promise<void> {
  await post(`${ADDR}.set_default_address`, { name }, "تعذّر تعيين العنوان الافتراضي.");
}

// -- store credit ----------------------------------------------------------

const WALLET = "ovira_marketplace.api.wallet";

export type WalletEntry = {
  name: string;
  entry_type: string;
  amount: number;
  reason?: string | null;
  note?: string | null;
  creation: string;
};

export type Wallet = { balance: number; currency?: string; entries: WalletEntry[] };

/**
 * `null` means the request failed, not that the balance is zero.
 *
 * The distinction matters more here than anywhere else in the app: a customer
 * whose refund landed in store credit and who is shown "0" will conclude their
 * money is gone. That exact confusion is why this store audits refunds now.
 */
export async function getWallet(limit = 20): Promise<Wallet | null> {
  return get<Wallet>(`${WALLET}.get_wallet`, { limit });
}

// -- loyalty ---------------------------------------------------------------

const LOYALTY = "ovira_marketplace.api.loyalty";

export type LoyaltyEntry = {
  name: string;
  entry_type: string;
  points: number;
  reason?: string | null;
  creation: string;
  expires_on?: string | null;
};

export type LoyaltyAccount = {
  /** False when the operator has the programme switched off — hide the screen. */
  enabled: boolean;
  balance: number;
  /** What the balance is worth in currency right now. */
  redeemable_value?: number;
  /** Currency per point, and the floor below which redemption is refused. */
  redeem_value?: number;
  min_redeem?: number;
  earn_rate?: number;
  currency?: string;
  expired_points?: number;
  /** The next batch to lapse — said out loud, rather than discovered as a drop. */
  next_expiry_on?: string | null;
  next_expiry_points?: number;
  entries: LoyaltyEntry[];
};

export async function myPoints(limit = 20): Promise<LoyaltyAccount | null> {
  return get<LoyaltyAccount>(`${LOYALTY}.my_points`, { limit });
}

/** Convert points into store credit. The server decides what they are worth. */
export async function redeemPoints(points: number): Promise<{ value: number; balance: number }> {
  return post(`${LOYALTY}.redeem_points`, { points }, "تعذّر استبدال النقاط.");
}
