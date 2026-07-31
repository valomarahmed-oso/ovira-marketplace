/**
 * What the customer will be charged — the client's copy of it.
 *
 * The server is the authority: `api/checkout.place_order` recomputes every one
 * of these numbers and ignores whatever the client sent. This exists only so the
 * cart can show a total before the order is placed, and it mirrors
 * `backend/ovira_marketplace/ovira_marketplace/totals.py` and `taxes.py`
 * deliberately, function for function.
 *
 * That mirroring is the point. Before this file, the same tax split was written
 * out by hand inside a React component, which is how a display and a charge
 * drift apart — the shopper agrees to one number and is billed another. If you
 * change the order of operations here, change it in `totals.py` in the same
 * commit, or the cart starts lying.
 *
 * Order of operations:
 *   1. discounts come off the goods
 *   2. tax is computed on the discounted goods
 *   3. store credit comes off last
 */

import type { CartLine, PriceTier, TaxDisclosure } from "./types.js";

/**
 * Unit price for a quantity once bulk tiers are considered.
 *
 * Mirrors `api/pricing.tier_unit_rate`, which is what checkout actually charges,
 * including its three guards: nothing applies below qty 2, a tier priced at or
 * above the base is ignored, and the cheapest reached tier wins rather than the
 * last one read. Showing "5 for 220 each" and then billing 250 is the kind of
 * discrepancy a shopper notices on the invoice and never forgives.
 */
export function tierUnitRate(basePrice: number, qty: number, tiers?: PriceTier[] | null): number {
  const base = round(basePrice);
  if (!tiers?.length || qty < 2) return base;
  let rate = base;
  for (const tier of tiers) {
    const price = Number(tier?.price) || 0;
    if (price > 0 && qty >= Number(tier.min_qty) && price < rate) rate = price;
  }
  return round(rate);
}

/** The next tier a shopper hasn't reached yet — "add 2 more and save". */
export function nextTier(qty: number, tiers?: PriceTier[] | null): PriceTier | null {
  const ahead = (tiers ?? [])
    .filter((t) => Number(t?.price) > 0 && Number(t.min_qty) > qty)
    .sort((a, b) => Number(a.min_qty) - Number(b.min_qty));
  return ahead[0] ?? null;
}

type PricedLine = Pick<CartLine, "price" | "qty"> & { tiers?: PriceTier[] };

/**
 * What one unit of this line actually costs at its current quantity.
 *
 * Always derived, never read off the line. Storing an already-discounted unit
 * price is how a cart came to bill six units at the full 250 each after five of
 * them had qualified for the 220 tier — the discount was earned, banked into
 * the line, and then silently lost when the quantity moved.
 */
export function lineUnitPrice(line: PricedLine): number {
  return tierUnitRate(line.price, line.qty, line.tiers);
}

export function lineTotal(line: PricedLine): number {
  return round(lineUnitPrice(line) * line.qty);
}

export function subtotal(lines: PricedLine[]): number {
  return round(lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.qty, 0));
}

/** Value of the items after both kinds of coupon, floored at zero. */
export function goodsTotal(sub: number, discount = 0, vendorDiscount = 0): number {
  return Math.max(0, round(sub - discount - vendorDiscount));
}

/**
 * Split an amount into `{net, tax}` under the store's tax profile.
 *
 * Inclusive: the tax is carved OUT of the amount (90 → 78.95 + 11.05) and the
 * total does not move. Exclusive: it sits ON TOP and must be added.
 */
export function splitTax(amount: number, tax: TaxDisclosure | null): { net: number; tax: number } {
  const rate = (tax?.rate ?? 0) / 100;
  if (!tax || rate <= 0 || amount <= 0) return { net: round(amount), tax: 0 };
  if (tax.inclusive) {
    const net = amount / (1 + rate);
    return { net: round(net), tax: round(amount - net) };
  }
  return { net: round(amount), tax: round(amount * rate) };
}

/** How much store credit this order can absorb. */
export function walletToSpend(balance: number, due: number): number {
  return Math.max(0, Math.min(balance, due));
}

export type CartTotals = {
  subtotal: number;
  goods: number;
  discount: number;
  shipping: number;
  /** Disclosed either way; only ADDED to the total when the tax is exclusive. */
  tax: number;
  taxInclusive: boolean;
  netBeforeTax: number;
  walletApplied: number;
  total: number;
};

export function cartTotals(input: {
  lines: PricedLine[];
  shipping?: number;
  discount?: number;
  vendorDiscount?: number;
  walletBalance?: number;
  useWallet?: boolean;
  tax?: TaxDisclosure | null;
}): CartTotals {
  const sub = subtotal(input.lines);
  const discount = input.discount ?? 0;
  const goods = goodsTotal(sub, discount, input.vendorDiscount ?? 0);
  const shipping = input.shipping ?? 0;

  const { net, tax } = splitTax(goods, input.tax ?? null);
  const inclusive = !!input.tax?.inclusive;
  const extraTax = inclusive ? 0 : tax;

  const due = round(goods + shipping + extraTax);
  const walletApplied = input.useWallet ? walletToSpend(input.walletBalance ?? 0, due) : 0;

  return {
    subtotal: sub,
    goods,
    discount,
    shipping,
    tax,
    taxInclusive: inclusive,
    netBeforeTax: net,
    walletApplied,
    total: Math.max(0, round(due - walletApplied)),
  };
}

/** Currency rounding. Money is never carried at full float precision. */
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
