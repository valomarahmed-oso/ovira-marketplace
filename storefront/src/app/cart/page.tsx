"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { OrderSummary } from "@/components/order-summary";
import { formatPrice } from "@/lib/utils";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="container-ovira py-10">
        <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <ShoppingBag className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">سلتك فاضية</h1>
          <p className="text-sm text-ink-400">ابدأ التسوّق وأضف منتجاتك المفضّلة.</p>
          <Link href="/" className="btn btn-primary inline-flex">
            تسوّق الآن <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = cartSubtotal(items);

  return (
    <div className="container-ovira space-y-6 py-6">
      <h1 className="text-2xl font-medium text-ink">السلة ({items.length})</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map(({ product: p, qty }) => (
            <div key={p.slug} className="card flex gap-4 p-3">
              <Link
                href={`/product/${p.slug}`}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-blue-50"
              >
                {p.image && <Image src={p.image} alt={p.title} fill sizes="96px" className="object-cover" />}
              </Link>
              <div className="flex grow flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/product/${p.slug}`} className="line-clamp-2 text-sm text-ink hover:text-blue-600">
                    {p.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(p.slug)}
                    aria-label="حذف من السلة"
                    className="text-ink-400 transition-colors hover:text-coral"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-xs text-ink-400">{p.vendor_name}</span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-xl border border-line">
                    <button
                      type="button"
                      onClick={() => setQty(p.slug, qty - 1)}
                      aria-label="إنقاص"
                      className="grid h-9 w-9 place-items-center text-ink-600 hover:text-blue-600"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-9 text-center font-tech text-sm">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(p.slug, qty + 1)}
                      aria-label="زيادة"
                      className="grid h-9 w-9 place-items-center text-ink-600 hover:text-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="font-tech font-medium text-ink">{formatPrice(p.price * qty, p.currency)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit">
          <OrderSummary subtotal={subtotal}>
            <Link href="/checkout" className="btn btn-primary w-full">
              إتمام الشراء <ArrowLeft className="h-4 w-4" />
            </Link>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}
