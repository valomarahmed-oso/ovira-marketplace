"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart, X, Zap } from "lucide-react";
import type { Product } from "@/lib/api";
import { OviraBars } from "@/components/ovira-bars";
import { useCart } from "@/lib/cart-store";
import { discountPercent, formatPrice } from "@/lib/utils";

export function ProductPurchase({ p }: { p: Product }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const soldOut = p.stock_qty <= 0;
  const max = Math.max(1, p.stock_qty);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const off = discountPercent(p.price, p.compare_at_price);

  function addToCart() {
    add(p, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1300);
  }

  function buyNow() {
    add(p, qty);
    router.push("/checkout");
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <span className="font-tech text-3xl font-medium text-ink">{formatPrice(p.price, p.currency)}</span>
        {p.compare_at_price && (
          <span className="font-tech text-base text-ink-400 line-through">
            {formatPrice(p.compare_at_price, p.currency)}
          </span>
        )}
        {off > 0 && (
          <span className="rounded-full bg-coral-50 px-2 py-0.5 font-tech text-sm text-coral">-{off}%</span>
        )}
      </div>

      <div className="text-sm">
        {soldOut ? (
          <span className="inline-flex items-center gap-1 text-coral">
            <X className="h-4 w-4" /> غير متوفر حاليًا
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-mint">
            <Check className="h-4 w-4" /> متوفر — {p.stock_qty} قطعة
          </span>
        )}
      </div>

      {!soldOut && (
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
          disabled={soldOut}
          className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          {added ? "تمت الإضافة للسلة" : "أضف للسلة"}
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={soldOut}
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
