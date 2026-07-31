/**
 * The client's pricing must agree with the server's.
 *
 * These are deliberately the SAME cases as
 * `backend/ovira_marketplace/tests/test_totals.py` and `test_taxes.py`. If one
 * suite is changed without the other, the cart shows one number and the invoice
 * bills another — which is exactly the failure this file exists to prevent.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cartTotals, goodsTotal, splitTax, subtotal, walletToSpend } from "../dist/pricing.js";

const INCLUSIVE = { rate: 14, inclusive: true, label: "VAT 14%" };
const EXCLUSIVE = { rate: 14, inclusive: false, label: "VAT 14%" };

describe("splitTax", () => {
  it("matches the general ledger figures the owner asked about", () => {
    // 90 EGP inclusive → 78.95 net + 11.05 VAT. Identical to taxes.split(90).
    assert.deepEqual(splitTax(90, INCLUSIVE), { net: 78.95, tax: 11.05 });
  });

  it("net plus tax adds back to the shelf price", () => {
    const { net, tax } = splitTax(250, INCLUSIVE);
    assert.equal(Math.round((net + tax) * 100) / 100, 250);
  });

  it("puts exclusive tax on top instead", () => {
    assert.deepEqual(splitTax(100, EXCLUSIVE), { net: 100, tax: 14 });
  });

  it("charges nothing when no template is configured", () => {
    assert.deepEqual(splitTax(90, null), { net: 90, tax: 0 });
  });
});

describe("goodsTotal", () => {
  it("takes both kinds of coupon off the goods", () => {
    assert.equal(goodsTotal(1000, 100, 50), 850);
  });

  it("never turns a large coupon into a credit", () => {
    assert.equal(goodsTotal(50, 200), 0);
  });
});

describe("walletToSpend", () => {
  it("is capped at the balance", () => {
    assert.equal(walletToSpend(30, 500), 30);
  });

  it("is capped at what is owed, so credit is never handed back as change", () => {
    assert.equal(walletToSpend(500, 30), 30);
  });
});

describe("cartTotals", () => {
  const lines = [{ price: 100, qty: 2 }];

  it("sums the lines", () => {
    assert.equal(subtotal(lines), 200);
  });

  it("leaves an inclusive-tax total exactly as the shelf price", () => {
    // The Egyptian retail norm and this store's live setting: disclosing the tax
    // must not change what the shopper pays.
    const t = cartTotals({ lines, tax: INCLUSIVE });
    assert.equal(t.total, 200);
    assert.equal(t.tax, 24.56);
    assert.equal(t.taxInclusive, true);
  });

  it("adds exclusive tax to the total", () => {
    const t = cartTotals({ lines, tax: EXCLUSIVE });
    assert.equal(t.total, 228);
  });

  it("applies store credit last, after tax", () => {
    // 100 + 14 tax − 50 credit = 64. Applying credit first would have the
    // customer paying tax on money they never spent, and the store
    // under-collecting the VAT it owes.
    const t = cartTotals({
      lines: [{ price: 100, qty: 1 }],
      tax: EXCLUSIVE,
      walletBalance: 50,
      useWallet: true,
    });
    assert.equal(t.total, 64);
  });

  it("floors at zero when credit covers everything", () => {
    const t = cartTotals({
      lines: [{ price: 100, qty: 1 }],
      shipping: 20,
      walletBalance: 500,
      useWallet: true,
    });
    assert.equal(t.total, 0);
  });

  it("prices discount, then tax, then shipping, in that order", () => {
    // 1000 goods − 100 coupon = 900; tax is computed on 900, not on 1000.
    const t = cartTotals({
      lines: [{ price: 1000, qty: 1 }],
      discount: 100,
      shipping: 50,
      tax: INCLUSIVE,
    });
    assert.equal(t.goods, 900);
    assert.equal(t.total, 950);
    assert.equal(t.netBeforeTax, 789.47);
  });
});
