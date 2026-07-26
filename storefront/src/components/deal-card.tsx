"use client";

import Link from "next/link";
import Image from "next/image";
import { Timer } from "lucide-react";
import type { Product } from "@/lib/api";
import type { Dict } from "@/lib/i18n";
import { OviraBars } from "@/components/ovira-bars";
import { discountPercent } from "@/lib/utils";
import { useMoney } from "@/lib/currency";

/** Deal-of-the-day card. Client-side because the price follows the shopper's
 *  chosen display currency. */
export function DealCard({ deal, t }: { deal: Product; t: Dict }) {
  const { money } = useMoney();
  const off = discountPercent(deal.price, deal.compare_at_price);
  return (
    <Link
      href={`/product/${deal.slug}`}
      className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-lift"
    >
      <div className="flex items-center justify-between bg-coral-50 px-5 py-3">
        <span className="flex items-center gap-2 font-medium text-coral">
          <Timer className="h-4 w-4" />
          {t.dealOfDay}
        </span>
        {off > 0 && <span className="font-tech text-sm font-medium text-coral">-{off}%</span>}
      </div>
      <div className="relative aspect-[4/3] bg-blue-50">
        {deal.image && (
          <Image
            src={deal.image}
            alt={deal.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex grow flex-col gap-2 p-5">
        <span className="text-xs text-ink-400">{deal.vendor_name}</span>
        <span className="line-clamp-2 text-sm leading-6 text-ink">{deal.title}</span>
        <div className="mt-auto flex items-end justify-between">
          <div>
            <div className="font-tech text-xl font-medium text-ink">{money(deal.price)}</div>
            {deal.compare_at_price && (
              <div className="font-tech text-xs text-ink-400 line-through">
                {money(deal.compare_at_price)}
              </div>
            )}
          </div>
          <OviraBars animated />
        </div>
      </div>
    </Link>
  );
}
