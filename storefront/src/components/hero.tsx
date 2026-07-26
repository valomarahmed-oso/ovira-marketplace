import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, Store, Timer, Truck } from "lucide-react";
import type { Banner, Product } from "@/lib/api";
import type { Dict } from "@/lib/i18n";
import { OviraBars } from "@/components/ovira-bars";
import { cn } from "@/lib/utils";
import { DealCard } from "@/components/deal-card";

export function Hero({
  hero,
  deal,
  t,
  multiVendor = true,
  badge,
}: {
  hero: Banner | null;
  deal: Product | null;
  t: Dict;
  multiVendor?: boolean;
  /** Operator-set badge text above the title; falls back to the built-in default. */
  badge?: string;
}) {
  const title = hero?.title ?? t.heroTitle;
  const subtitle = hero?.subtitle ?? t.heroSubtitle;
  const ctaLink = hero?.link || "/products";
  const ctaLabel = hero?.cta_label || t.shopNow;
  const badgeText = badge || t.heroBadge;

  return (
    <section className={cn("grid gap-4", deal ? "lg:grid-cols-3" : "lg:grid-cols-1")}>
      <div
        className={cn(
          "clip-corner relative overflow-hidden rounded-3xl bg-blue p-8 text-white md:p-12",
          deal && "lg:col-span-2",
        )}
      >
        {hero?.image && (
          <>
            <Image src={hero.image} alt="" fill priority sizes="66vw" className="object-cover" />
            <div className="absolute inset-0 bg-blue/80" aria-hidden="true" />
          </>
        )}
        <div
          className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full border-[28px] border-white/10"
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <div className="mb-5 flex items-center gap-2 text-sm text-white/85">
            <OviraBars tone="white" />
            <span>{badgeText}</span>
          </div>
          <h1 className="text-3xl font-medium leading-snug md:text-5xl md:leading-[1.15]">{title}</h1>
          <p className="mt-4 text-base text-white/85 md:text-lg">{subtitle}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={ctaLink} className="btn bg-white px-6 py-3 text-blue-600 hover:bg-blue-50">
              {ctaLabel}
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {multiVendor && (
              <Link href="/sell" className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10">
                <Store className="h-4 w-4" />
                {t.becomeVendor}
              </Link>
            )}
          </div>

          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/90">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t.freeShipping}
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t.securePayment}
            </span>
            <span className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              {t.support}
            </span>
          </div>
        </div>
      </div>

      {deal && <DealCard deal={deal} t={t} />}
    </section>
  );
}
