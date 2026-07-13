"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Loader2, ShoppingCart, Star, X } from "lucide-react";
import { getProduct, type Product } from "@/lib/api";
import { useQuickView } from "@/lib/quick-view-store";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/utils";

/** Global quick-view modal: a fast product summary + add-to-cart without leaving
 * the listing. Mounted once in the root layout. */
export function QuickView() {
  const summary = useQuickView((s) => s.product);
  const close = useQuickView((s) => s.close);
  const add = useCart((s) => s.add);
  const [full, setFull] = useState<Product | null>(null);
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);

  // Fetch the full product (gallery + description) once opened.
  useEffect(() => {
    if (!summary) {
      setFull(null);
      setActive(0);
      return;
    }
    let cancelled = false;
    getProduct(summary.slug).then((p) => {
      if (!cancelled && p) setFull(p);
    });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  // Close on Escape.
  useEffect(() => {
    if (!summary) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [summary, close]);

  if (!summary) return null;
  const p = full ?? summary;
  const images: string[] = p.media?.length
    ? p.media.map((m) => m.image).filter(Boolean)
    : p.image
      ? [p.image]
      : [];
  const soldOut = p.stock_qty <= 0;

  function addToCart() {
    add(p);
    setAdded(true);
    setTimeout(() => setAdded(false), 1300);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="إغلاق"
          className="absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink-600 hover:text-coral"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Gallery */}
          <div className="space-y-2">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-blue-50">
              {images[active] ? (
                <Image src={images[active]} alt={p.title} fill sizes="(max-width:640px) 90vw, 320px" className="object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-ink-300">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.slice(0, 5).map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${i === active ? "border-blue" : "border-line"}`}
                  >
                    <Image src={src} alt="" fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-3">
            {p.vendor_name && <div className="text-xs text-ink-400">{p.vendor_name}</div>}
            <Link href={`/product/${p.slug}`} onClick={close} className="text-lg font-medium leading-7 text-ink hover:text-blue-600">
              {p.title}
            </Link>

            {typeof p.rating === "number" && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-gold text-gold" />
                <span className="font-tech text-ink">{p.rating.toFixed(1)}</span>
                <span className="text-ink-400">({p.reviews})</span>
              </div>
            )}

            <div className="flex items-end gap-2">
              <span className="font-tech text-2xl font-medium text-ink">{formatPrice(p.price, p.currency)}</span>
              {p.compare_at_price ? (
                <span className="font-tech text-sm text-ink-400 line-through">{formatPrice(p.compare_at_price, p.currency)}</span>
              ) : null}
            </div>

            {p.short_description && <p className="text-sm leading-6 text-ink-600">{p.short_description}</p>}

            <div className="mt-auto space-y-2 pt-2">
              {p.has_variants ? (
                <Link href={`/product/${p.slug}`} onClick={close} className="btn btn-primary w-full text-sm">
                  <ShoppingCart className="h-4 w-4" /> اختر الخيارات
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={addToCart}
                  disabled={soldOut}
                  className="btn btn-primary w-full text-sm disabled:opacity-40"
                >
                  {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                  {soldOut ? "غير متوفّر" : added ? "أُضيف للسلة" : "أضف للسلة"}
                </button>
              )}
              <Link href={`/product/${p.slug}`} onClick={close} className="block text-center text-sm text-blue-600 hover:underline">
                عرض كل التفاصيل
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
