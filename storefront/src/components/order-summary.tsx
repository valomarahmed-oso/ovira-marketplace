import { shippingFor } from "@/lib/cart-store";
import { formatPrice } from "@/lib/utils";

export function OrderSummary({
  subtotal,
  children,
}: {
  subtotal: number;
  children?: React.ReactNode;
}) {
  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;

  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-lg font-medium text-ink">ملخّص الطلب</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-ink-600">
          <span>الإجمالي الفرعي</span>
          <span className="font-tech text-ink">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-ink-600">
          <span>الشحن</span>
          <span className="font-tech text-ink">
            {shipping === 0 ? <span className="text-mint">مجاني</span> : formatPrice(shipping)}
          </span>
        </div>
        {shipping > 0 && (
          <p className="text-xs text-ink-400">
            أضف منتجات بقيمة {formatPrice(500 - subtotal)} للحصول على شحن مجاني.
          </p>
        )}
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-medium text-ink">
        <span>الإجمالي</span>
        <span className="font-tech">{formatPrice(total)}</span>
      </div>
      {children}
    </div>
  );
}
