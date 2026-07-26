"use client";

import { shippingFor } from "@/lib/cart-store";
import { useMoney } from "@/lib/currency";
import { formatPrice } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

export function OrderSummary({
  subtotal,
  shipping: shippingOverride,
  shippingLoading = false,
  discount = 0,
  walletApplied = 0,
  walletLabel = "رصيد المتجر",
  children,
}: {
  subtotal: number;
  /** Live rate from the backend; null/undefined falls back to the local estimate. */
  shipping?: number | null;
  /** True while the live server rate is being fetched — show a placeholder
   * instead of the local estimate so shipping never wrongly reads "free". */
  shippingLoading?: boolean;
  /** Coupon discount applied to the order. */
  discount?: number;
  /** Store credit spent on the order. */
  walletApplied?: number;
  walletLabel?: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { money, converted, base } = useMoney();
  const shipping = shippingOverride ?? shippingFor(subtotal);
  const total = Math.max(0, subtotal + shipping - discount - walletApplied);

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-lg font-medium text-ink">ملخّص الطلب</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-ink-600">
          <span>الإجمالي الفرعي</span>
          <span className="font-tech text-ink">{money(subtotal)}</span>
        </div>
        <div className="flex justify-between text-ink-600">
          <span>الشحن</span>
          <span className="font-tech text-ink">
            {shippingLoading ? (
              <span className="text-ink-400">يُحسب…</span>
            ) : shipping === 0 ? (
              <span className="text-mint">مجاني</span>
            ) : (
              money(shipping)
            )}
          </span>
        </div>
        {shippingOverride == null && shipping > 0 && (
          <p className="text-xs text-ink-400">
            أضف منتجات بقيمة {money(500 - subtotal)} للحصول على شحن مجاني.
          </p>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-mint">
            <span>الخصم</span>
            <span className="font-tech">−{money(discount)}</span>
          </div>
        )}
        {walletApplied > 0 && (
          <div className="flex justify-between text-mint">
            <span>{walletLabel}</span>
            <span className="font-tech">−{money(walletApplied)}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-medium text-ink">
        <span>الإجمالي</span>
        <span className="font-tech">{money(total)}</span>
      </div>
      {/* Conversion is presentational — the charge is always taken in the base
          currency, so say so before the shopper commits. */}
      {converted && (
        <p className="rounded-xl bg-[#fdf2dd] px-3 py-2 text-xs text-[#854f0b]">
          {t.curChargedIn.replace("{0}", formatPrice(total, base))}
        </p>
      )}
      {children}
    </div>
  );
}
