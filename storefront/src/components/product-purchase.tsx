"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart, X, Zap } from "lucide-react";
import type { Product, ProductVariant } from "@/lib/api";
import { Countdown } from "@/components/countdown";
import { OviraBars } from "@/components/ovira-bars";
import { useCart } from "@/lib/cart-store";
import { cn, discountPercent, formatPrice } from "@/lib/utils";

export function ProductPurchase({ p }: { p: Product }) {
  const router = useRouter();
  const add = useCart((s) => s.add);

  const variants = p.variants ?? [];
  const hasVariants = !!p.has_variants && variants.length > 0;
  const [sel, setSel] = useState<ProductVariant | null>(null);

  // Effective price/stock reflect the chosen variant (if any).
  const price = sel ? sel.price : p.price;
  const stock = hasVariants ? (sel ? sel.stock_qty : 0) : p.stock_qty;
  const needsChoice = hasVariants && !sel;
  const soldOut = !needsChoice && stock <= 0;
  const max = Math.max(1, stock);

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const off = discountPercent(price, p.compare_at_price);

  function cartVariant() {
    return sel ? { sku: sel.sku, value: sel.option_value, price: sel.price } : undefined;
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
            <Zap className="h-4 w-4 fill-coral" /> عرض فلاش
          </span>
          <Countdown endsOn={deal.ends_on} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <span className="font-tech text-3xl font-medium text-ink">{formatPrice(price, p.currency)}</span>
        {p.compare_at_price && (
          <span className="font-tech text-base text-ink-400 line-through">
            {formatPrice(p.compare_at_price, p.currency)}
          </span>
        )}
        {off > 0 && (
          <span className="rounded-full bg-coral-50 px-2 py-0.5 font-tech text-sm text-coral">-{off}%</span>
        )}
      </div>

      {hasVariants && (
        <div className="space-y-2">
          <span className="text-sm text-ink-600">{p.variant_option_name || "الخيار"}</span>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const vSoldOut = v.stock_qty <= 0;
              const active = sel?.sku === v.sku;
              return (
                <button
                  key={v.sku}
                  type="button"
                  disabled={vSoldOut}
                  onClick={() => {
                    setSel(v);
                    setQty(1);
                  }}
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

      <div className="text-sm">
        {needsChoice ? (
          <span className="text-ink-400">اختر {p.variant_option_name || "خيارًا"} لعرض التوفّر.</span>
        ) : soldOut ? (
          <span className="inline-flex items-center gap-1 text-coral">
            <X className="h-4 w-4" /> غير متوفر حاليًا
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-mint">
            <Check className="h-4 w-4" /> متوفر — {stock} قطعة
          </span>
        )}
      </div>

      {!soldOut && !needsChoice && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-600">الكمية</span>
          <div className="flex items-center rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="إنقاص الكمية"
              className="grid h-10 w-10 place-items-center text-ink-600 transition-colors hover:text-blue-600"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-tech">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              aria-label="زيادة الكمية"
              className="grid h-10 w-10 place-items-center text-ink-600 transition-colors hover:text-blue-600"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={addToCart}
          disabled={soldOut || needsChoice}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          {added ? "تمت الإضافة للسلة" : needsChoice ? `اختر ${p.variant_option_name || "خيارًا"}` : "أضف للسلة"}
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={soldOut || needsChoice}
          className="btn btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Zap className="h-5 w-5" /> اشترِ الآن
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1 text-xs text-ink-400">
        <OviraBars /> شحن سريع · دفع آمن · إرجاع خلال ١٤ يوم
      </div>
    </div>
  );
}
