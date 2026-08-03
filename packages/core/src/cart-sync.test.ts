/**
 * Merging two carts decides how many of something a shopper is about to buy,
 * which makes it a money decision and not a convenience.
 *
 * The rule under test: quantities are reconciled, never summed. Adding them
 * would turn "two on my phone, two on the website" into an order for four —
 * an inflation the shopper never asked for and would only notice at checkout.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// From `dist`, like the other suites: these modules import each other with the
// built `.js` extensions, which only resolve after `npm run build`.
import type { CartLine } from "../dist/types.js";
import { mergeCarts } from "../dist/cart-sync.js";

const line = (slug: string, qty: number, variant?: string): CartLine => ({
  slug,
  title: slug,
  price: 100,
  qty,
  variant: variant ?? null,
});

describe("mergeCarts", () => {
  it("keeps lines that exist on only one side", () => {
    const merged = mergeCarts([line("a", 1)], [line("b", 2)]);
    assert.deepEqual(
      merged.map((l) => [l.slug, l.qty]),
      [
        ["a", 1],
        ["b", 2],
      ],
    );
  });

  it("does NOT add quantities for the same line", () => {
    // The whole point. 2 + 2 must be 2, not 4.
    const merged = mergeCarts([line("a", 2)], [line("a", 2)]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.qty, 2);
  });

  it("takes the larger quantity when the two disagree", () => {
    assert.equal(mergeCarts([line("a", 1)], [line("a", 5)])[0]?.qty, 5);
    assert.equal(mergeCarts([line("a", 5)], [line("a", 1)])[0]?.qty, 5);
  });

  it("treats the same product with different variants as different lines", () => {
    // A red one and a blue one are two things, and collapsing them would
    // silently drop whichever the shopper chose second.
    const merged = mergeCarts([line("shirt", 1, "red")], [line("shirt", 1, "blue")]);
    assert.equal(merged.length, 2);
  });

  it("treats a missing variant and an explicit null as the same line", () => {
    const local: CartLine = { slug: "a", title: "a", price: 1, qty: 1 };
    const merged = mergeCarts([local], [line("a", 3)]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.qty, 3);
  });

  it("keeps the local line's own fields when the remote only wins on quantity", () => {
    const local = { ...line("a", 1), title: "the local title" };
    const merged = mergeCarts([local], [{ ...line("a", 9), title: "stale remote title" }]);
    assert.equal(merged[0]?.title, "the local title");
    assert.equal(merged[0]?.qty, 9);
  });

  it("handles either side being empty", () => {
    assert.equal(mergeCarts([], [line("a", 1)]).length, 1);
    assert.equal(mergeCarts([line("a", 1)], []).length, 1);
    assert.deepEqual(mergeCarts([], []), []);
  });

  it("is idempotent — merging a merged cart changes nothing", () => {
    const once = mergeCarts([line("a", 2)], [line("a", 5), line("b", 1)]);
    assert.deepEqual(mergeCarts(once, once), once);
  });
});
