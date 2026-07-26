"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart, X, Zap } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/api";
import { Countdown } from "@/components/countdown";
import { OviraBars } from "@/components/ovira-bars";
import { useCart } from "@/lib/cart-store";
import { useVariantImage } from "@/lib/variant-image-store";
import { StockAlertButton } from "@/components/stock-alert-button";
import { useI18n } from "@/components/i18n-provider";
import { cn, discountPercent } from "@/lib/utils";
import { useMoney } from "@/lib/currency";

export function ProductPurchase({ p }: { p: Product }) {
  const { t } = useI18n();
  const { money } = useMoney();
  const router = useRouter();
  const add = useCart((s) => s.add);

  const variants = p.variants ?? [];
  const hasVariants = !!p.has_variants && variants.length > 0;
  const [sel, setSel] = useState<ProductVariant | null>(null);
  const setVariantImage = useVariantImage((s) => s.setImage);

  // Two-axis variants (e.g. size x colour): render two selectors and resolve the
  // matching variant once both are picked. Single-axis keeps the simple picker.
  const twoAxis = variants.some((v) => !!v.option_value2);
  const axis1 = [...new Set(variants.map((v) => v.option_value))];
  const axis2 = [...new Set(variants.map((v) => (v.option_value2 || "").trim()).filter(Boolean))];
  const [v1, setV1] = useState<string | null>(null);
  const [v2, setV2] = useState<string | null>(null);

  function findVariant(a: string | null, b: string | null) {
    return variants.find((v) => v.option_value === a && (v.option_value2 || "") === (b || "")) ?? null;
  }
  function comboStock(a: string, b: string) {
    const v = findVariant(a, b);
    return v ? v.stock_qty : 0;
  }

  // Clear any lingering variant image when leaving the product (the store is
  // global, so the next product must start from its own photos).
  useEffect(() => () => setVariantImage(null), [setVariantImage]);

  function chooseVariant(v: ProductVariant) {
    setSel(v);
    setV1(v.option_value);
    setQty(1);
    setVariantImage(v.image ?? null);
  }

  function pickAxis1(a: string) {
    setV1(a);
    const v = findVariant(a, v2);
    setSel(v);
    setQty(1);
    setVariantImage(v?.image ?? null);
  }
  function pickAxis2(b: string) {
    setV2(b);
    const v = findVariant(v1, b);
    setSel(v);
    setQty(1);
    setVariantImage(v?.image ?? null);
  }

  // Effective price/stock reflect the chosen variant (if any).
  const price = sel ? sel.price : p.price;
  const stock = hasVariants ? (sel ? sel.stock_qty : 0) : p.stock_qty;
  const needsChoice = hasVariants && !sel;
  const soldOut = !needsChoice && stock <= 0;
  const max = Math.max(1, stock);

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // Bulk/quantity price tiers (single-price products): the unit price drops once
  // the quantity reaches a tier. Server recomputes at checkout — this mirrors it.
  const tiers = !hasVariants && p.price_tiers?.length
    ? [...p.price_tiers].sort((a, b) => a.min_qty - b.min_qty)
    : [];
  function tierRate(q: number) {
    let r = p.price;
    for (const tr of tiers) if (tr.price > 0 && q >= tr.min_qty && tr.price < r) r = tr.price;
    return r;
  }
  const unitPrice = tiers.length ? tierRate(qty) : price;
  const off = discountPercent(unitPrice, p.compare_at_price);

  function cartVariant() {
    if (!sel) return undefined;
    const value = sel.option_value2 ? `${sel.option_value} / ${sel.option_value2}` : sel.option_value;
    return { sku: sel.sku, value, price: sel.price };
  }

  function addToCart() {
    if (needsChoice || soldOut) return;
    add(p, Math.min(qty, max), cartVariant());
    setAdded(true);
    setTimeout(() => setAdded(false), 1300);
  }

  function buyNow() {
    if (needsChoice || soldOut) return;
    add(p, Math.min(qty, max), cartVariant());
    router.push("/checkout");
  }

  // A live flash deal (single-price products only) drives a countdown banner.
  const deal = !hasVariants ? p.deal : undefined;

  return (
    <div className="card space-y-4 p-5">
      {deal && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-coral-50 px-3 py-2 text-coral">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Zap className="h-4 w-4 fill-coral" /> {t.flashDeal}
          </span>
          <Countdown endsOn={deal.ends_on} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <span className="font-tech text-3xl font-medium text-ink">{money(unitPrice)}</span>
        {tiers.length > 0 && unitPrice < price ? (
          <span className="font-tech text-base text-ink-400 line-through">{money(price)}</span>
        ) : (
          p.compare_at_price && (
            <span className="font-tech text-base text-ink-400 line-through">
              {money(p.compare_at_price)}
            </span>
          )
        )}
        {off > 0 && (
          <span className="rounded-full bg-coral-50 px-2 py-0.5 font-tech text-sm text-coral">-{off}%</span>
        )}
      </div>

      {tiers.length > 0 && (
        <div className="rounded-xl border border-line p-3">
          <div className="mb-2 text-xs font-medium text-ink-600">{t.tierTitle}</div>
          <div className="flex flex-wrap gap-2">
            {tiers.map((tr) => (
              <span
                key={tr.min_qty}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs",
                  qty >= tr.min_qty ? "border-blue bg-blue-50 text-blue-600" : "border-line text-ink-600",
                )}
              >
                {t.tierRow.replace("{n}", String(tr.min_qty))} · {money(tr.price)}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasVariants && !twoAxis && (
        <div className="space-y-2">
          <span className="text-sm text-ink-600">{p.variant_option_name || t.purOption}</span>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const vSoldOut = v.stock_qty <= 0;
              const active = sel?.sku === v.sku;
              return (
                <button
                  key={v.sku}
                  type="button"
                  disabled={vSoldOut}
                  onClick={() => chooseVariant(v)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm transition-colors",
                    active ? "border-blue bg-blue-50 text-blue-600" : "border-line text-ink-600 hover:border-blue",
                    vSoldOut && "cursor-not-allowed text-ink-400 line-through opacity-60",
                  )}
                >
                  {v.option_value}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasVariants && twoAxis && (
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-sm text-ink-600">{p.variant_option_name || t.purOption}</span>
            <div className="flex flex-wrap gap-2">
              {axis1.map((a) => {
                const active = v1 === a;
                // Sold out if, given the chosen 2nd axis, no stock (or none across b2 when unset).
                const out = v2 ? comboStock(a, v2) <= 0 : !axis2.some((b) => comboStock(a, b) > 0) && (axis2.length ? true : comboStock(a, "") <= 0);
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={out}
                    onClick={() => pickAxis1(a)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm transition-colors",
                      active ? "border-blue bg-blue-50 text-blue-600" : "border-line text-ink-600 hover:border-blue",
                      out && "cursor-not-allowed text-ink-400 line-through opacity-60",
                    )}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-sm text-ink-600">{p.variant_option_name2 || t.purOption}</span>
            <div className="flex flex-wrap gap-2">
              {axis2.map((b) => {
                const active = v2 === b;
                const out = v1 ? comboStock(v1, b) <= 0 : !axis1.some((a) => comboStock(a, b) > 0);
                return (
                  <button
                    key={b}
                    type="button"
                    disabled={out}
                    onClick={() => pickAxis2(b)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm transition-colors",
                      active ? "border-blue bg-blue-50 text-blue-600" : "border-line text-ink-600 hover:border-blue",
                      out && "cursor-not-allowed text-ink-400 line-through opacity-60",
                    )}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="text-sm">
        {needsChoice ? (
          <span className="text-ink-400">
            {t.purChooseToSee.replace("{opt}", p.variant_option_name || t.purOptionAcc)}
          </span>
        ) : soldOut ? (
          <span className="inline-flex items-center gap-1 text-coral">
            <X className="h-4 w-4" /> {t.purOutNow}
          </span>
        ) : stock <= 5 ? (
          <span className="inline-flex items-center gap-1 font-medium text-coral">
            <Check className="h-4 w-4" /> {t.purLowStock.replace("{n}", String(stock))}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-mint">
            <Check className="h-4 w-4" /> {t.purInStock.replace("{n}", String(stock))}
          </span>
        )}
      </div>

      {!soldOut && !needsChoice && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-600">{t.purQty}</span>
          <div className="flex items-center rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label={t.purDecQty}
              className="grid h-10 w-10 place-items-center text-ink-600 transition-colors hover:text-blue-600"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-tech">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              aria-label={t.purIncQty}
              className="grid h-10 w-10 place-items-center text-ink-600 transition-colors hover:text-blue-600"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {soldOut ? (
          <StockAlertButton slug={p.slug} />
        ) : (
          <>
            <button
              type="button"
              onClick={addToCart}
              disabled={needsChoice}
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
              {added
                ? t.purAdded
                : needsChoice
                  ? `${t.purChoose} ${p.variant_option_name || t.purOptionAcc}`
                  : t.addToCart}
            </button>
            <button
              type="button"
              onClick={buyNow}
              disabled={needsChoice}
              className="btn btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Zap className="h-5 w-5" /> {t.purBuyNow}
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 text-xs text-ink-400">
        <OviraBars /> {t.purAssurances}
      </div>
    </div>
  );
}
