"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, Heart, ShoppingCart, Star, Store } from "lucide-react";
import type { Product } from "@/lib/api";
import { OviraBars } from "@/components/ovira-bars";
import { useCart } from "@/lib/cart-store";
import { useWishlist } from "@/lib/wishlist-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, discountPercent, formatPrice } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { useAppConfig } from "@/components/app-config-provider";

export function ProductCard({ p }: { p: Product }) {
  const { t } = useI18n();
  const { multiVendor } = useAppConfig();
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);
  const wishItems = useWishlist((s) => s.items);
  const toggleWish = useWishlist((s) => s.toggle);
  const hydrated = useHydrated();
  const wished = hydrated && wishItems.some((i) => i.slug === p.slug);
  const off = discountPercent(p.price, p.compare_at_price);
  const soldOut = p.stock_qty <= 0;

  function addToCart() {
    add(p);
    setAdded(true);
    setTimeout(() => setAdded(false), 1300);
  }

  return (
    <div className="group card flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
      <div className="relative aspect-square bg-blue-50">
        <Link href={`/product/${p.slug}`} className="relative block h-full w-full">
          {p.image && (
            <Image
              src={p.image}
              alt={p.title}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </Link>

        {off > 0 && (
          <span className="absolute start-3 top-3 rounded-full bg-coral px-2 py-1 font-tech text-xs font-medium text-white">
            {off}% {t.off}
          </span>
        )}

        <button
          type="button"
          onClick={() => toggleWish(p)}
          aria-label={t.wishlist}
          aria-pressed={wished}
          className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-line bg-white/90 text-ink-600 backdrop-blur transition-colors hover:text-coral"
        >
          <Heart className={cn("h-4 w-4", wished && "fill-coral text-coral")} />
        </button>

        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-white/55">
            <span className="rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink">
              {t.outOfStock}
            </span>
          </div>
        )}
      </div>

      <div className="flex grow flex-col gap-2 p-3">
        {multiVendor && p.vendor_name && (
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <Store className="h-3.5 w-3.5" />
            <span>{p.vendor_name}</span>
          </div>
        )}

        <Link
          href={`/product/${p.slug}`}
          className="line-clamp-2 min-h-[3rem] text-sm leading-6 text-ink transition-colors hover:text-blue-600"
        >
          {p.title}
        </Link>

        {typeof p.rating === "number" && (
          <div className="flex items-center gap-1 text-xs">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            <span className="font-tech text-ink">{p.rating.toFixed(1)}</span>
            <span className="text-ink-400">({p.reviews})</span>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <div className="font-tech text-lg font-medium text-ink">
              {formatPrice(p.price, p.currency)}
            </div>
            {p.compare_at_price && (
              <div className="font-tech text-xs text-ink-400 line-through">
                {formatPrice(p.compare_at_price, p.currency)}
              </div>
            )}
          </div>
          <OviraBars animated className="pb-1" />
        </div>

        <button
          type="button"
          onClick={addToCart}
          disabled={soldOut}
          className="btn btn-primary mt-1 w-full text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {added ? t.added : t.addToCart}
        </button>
      </div>
    </div>
  );
}
