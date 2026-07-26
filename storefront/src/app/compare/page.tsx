"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Scale, ShoppingCart, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useCompare } from "@/lib/compare-store";
import { useCart } from "@/lib/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { useI18n } from "@/components/i18n-provider";
import { useMoney } from "@/lib/currency";

export default function ComparePage() {
  const { t } = useI18n();
  const { money } = useMoney();
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  const add = useCart((s) => s.add);
  const hydrated = useHydrated();
  const [added, setAdded] = useState<string | null>(null);

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Scale className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.cmpEmptyTitle}</h1>
          <p className="text-sm text-ink-400">{t.cmpEmptyHint}</p>
          <Link href="/products" className="btn btn-primary inline-flex">{t.wishBrowse}</Link>
        </div>
      </div>
    );
  }

  const cell = "border-b border-line p-3 align-top";
  const rowLabel = "whitespace-nowrap p-3 text-xs font-medium text-ink-400";

  function addToCart(slug: string) {
    const p = items.find((i) => i.slug === slug);
    if (!p) return;
    add(p);
    setAdded(slug);
    setTimeout(() => setAdded(null), 1300);
  }

  return (
    <div className="container-ovira space-y-6 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-medium text-ink">
          <Scale className="h-6 w-6 text-blue-600" /> {t.cmpTitle}
        </h1>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-coral">
          <Trash2 className="h-4 w-4" /> {t.cmpClearAll}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <tbody>
            {/* image + remove */}
            <tr>
              <td className={rowLabel} />
              {items.map((p) => (
                <td key={p.slug} className={cell}>
                  <div className="relative">
                    <Link href={`/product/${p.slug}`} className="relative block aspect-square w-full overflow-hidden rounded-xl bg-blue-50">
                      {p.image && <Image src={p.image} alt={p.title} fill sizes="200px" className="object-cover" />}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(p.slug)}
                      aria-label={t.cmpRemove}
                      className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-600 shadow hover:text-coral"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              ))}
            </tr>
            {/* title */}
            <tr>
              <td className={rowLabel}>{t.cmpProduct}</td>
              {items.map((p) => (
                <td key={p.slug} className={cell}>
                  <Link href={`/product/${p.slug}`} className="line-clamp-2 text-ink hover:text-blue-600">{p.title}</Link>
                </td>
              ))}
            </tr>
            {/* price */}
            <tr>
              <td className={rowLabel}>{t.cmpPrice}</td>
              {items.map((p) => (
                <td key={p.slug} className={cell}>
                  <div className="font-tech text-lg font-medium text-ink">{money(p.price)}</div>
                  {p.compare_at_price ? (
                    <div className="font-tech text-xs text-ink-400 line-through">{money(p.compare_at_price)}</div>
                  ) : null}
                </td>
              ))}
            </tr>
            {/* rating */}
            <tr>
              <td className={rowLabel}>{t.cmpRating}</td>
              {items.map((p) => (
                <td key={p.slug} className={cell}>
                  {typeof p.rating === "number" ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                      <span className="font-tech text-ink">{p.rating.toFixed(1)}</span>
                      <span className="text-ink-400">({p.reviews})</span>
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
              ))}
            </tr>
            {/* vendor */}
            <tr>
              <td className={rowLabel}>{t.byVendor}</td>
              {items.map((p) => (
                <td key={p.slug} className={cell}>{p.vendor_name || "—"}</td>
              ))}
            </tr>
            {/* availability */}
            <tr>
              <td className={rowLabel}>{t.cmpAvailability}</td>
              {items.map((p) => (
                <td key={p.slug} className={cell}>
                  {p.stock_qty > 0 ? <span className="text-mint">{t.cmpInStock}</span> : <span className="text-coral">{t.cmpOutStock}</span>}
                </td>
              ))}
            </tr>
            {/* action */}
            <tr>
              <td className={rowLabel} />
              {items.map((p) => (
                <td key={p.slug} className={cell}>
                  {p.has_variants ? (
                    <Link href={`/product/${p.slug}`} className="btn btn-primary w-full text-sm">{t.cmpChooseOptions}</Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(p.slug)}
                      disabled={p.stock_qty <= 0}
                      className="btn btn-primary w-full text-sm disabled:opacity-40"
                    >
                      {added === p.slug ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                      {added === p.slug ? t.cmpAdded : t.addToCart}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
